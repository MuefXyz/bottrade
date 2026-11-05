import type { Api } from 'grammy';
import { Context } from 'grammy';
import { parseMode } from '../config.js';
import { copyTrade } from '../copyTrade/index.js';
import { formatPositionBoard } from '../copyTrade/format.js';
import type { CopyPositionView } from '../copyTrade/types.js';
import { normalizeLang, t, type Lang } from '../i18n.js';
import { positionsInlineKeyboard } from '../keyboards/mainMenu.js';
import { getOrCreateUser } from '../services/userService.js';
import {
  isMessageNotModified,
  safeAnswerCallbackQuery,
  safeEditMessageText,
} from '../utils/telegram.js';

/** Interval auto-refresh panel Posisi Terbuka. */
const REFRESH_MS = 10_000;

interface LivePanel {
  messageId: number;
  telegramId: string;
  lang: Lang;
  timer: NodeJS.Timeout;
  busy: boolean;
}

const panels = new Map<number, LivePanel>();
let api: Api | null = null;

/** Hentikan auto-refresh saat user meninggalkan panel Posisi Terbuka. */
export function stopPositionsAutoRefresh(chatId: number): void {
  const panel = panels.get(chatId);
  if (panel === undefined) return;
  clearInterval(panel.timer);
  panels.delete(chatId);
}

function buildView(
  lang: Lang,
  positions: CopyPositionView[],
): { text: string; keyboard: ReturnType<typeof positionsInlineKeyboard> } {
  return {
    text: formatPositionBoard(positions, lang, {
      title: t(lang, 'positionsTitle'),
    }),
    keyboard: positionsInlineKeyboard(lang, positions),
  };
}

async function refreshPanel(chatId: number): Promise<void> {
  const panel = panels.get(chatId);
  if (panel === undefined || panel.busy || api === null) return;

  panel.busy = true;
  try {
    const positions = await copyTrade.getOpenPositionViews(panel.telegramId);
    const { text, keyboard } = buildView(panel.lang, positions);

    await api.editMessageText(chatId, panel.messageId, text, {
      parse_mode: parseMode(),
      reply_markup: keyboard,
    });
  } catch (error) {
    // "message is not modified" bukan masalah; error lain (pesan dihapus,
    // chat diblokir, dll) hentikan timer supaya tidak spam.
    if (!isMessageNotModified(error)) {
      console.warn(
        '⚠️ [positions] auto-refresh berhenti:',
        error instanceof Error ? error.message : String(error),
      );
      stopPositionsAutoRefresh(chatId);
    }
  } finally {
    panel.busy = false;
  }
}

function startAutoRefresh(
  chatId: number,
  messageId: number,
  telegramId: string,
  lang: Lang,
): void {
  stopPositionsAutoRefresh(chatId);
  if (api === null) return;

  const timer = setInterval(() => {
    void refreshPanel(chatId);
  }, REFRESH_MS);
  timer.unref?.();

  panels.set(chatId, { messageId, telegramId, lang, timer, busy: false });
}

async function renderPositions(
  ctx: Context,
  lang: Lang,
  telegramId: string,
): Promise<void> {
  const positions = await copyTrade.getOpenPositionViews(telegramId);
  const { text, keyboard } = buildView(lang, positions);

  await safeEditMessageText(ctx, text, {
    parse_mode: parseMode(),
    reply_markup: keyboard,
  });
}

/**
 * Panel "Posisi Terbuka" dari menu utama.
 * PnL di-refresh otomatis tiap 10 detik + tombol close per token.
 */
export async function positionsHandler(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  api = ctx.api;

  const telegramId = String(chatId);
  const user = await getOrCreateUser(telegramId, ctx.from?.username);
  const lang = normalizeLang(user.language);
  const data = ctx.callbackQuery?.data ?? '';

  if (data.startsWith('pos:close:')) {
    const positionId = Number(data.slice('pos:close:'.length));
    const result = await copyTrade.closeManually(chatId, positionId);

    if (result === 'closed') {
      await safeAnswerCallbackQuery(ctx, {
        text: t(lang, 'copyManualClosed'),
      });
    } else if (result === 'busy') {
      await safeAnswerCallbackQuery(ctx, {
        text: t(lang, 'copyManualBusy'),
      });
    } else {
      await safeAnswerCallbackQuery(ctx, {
        text: t(
          lang,
          result === 'not_found' ? 'copyManualNotFound' : 'copyManualFailed',
        ),
        show_alert: true,
      });
    }
  } else {
    await safeAnswerCallbackQuery(ctx);
  }

  await renderPositions(ctx, lang, telegramId);

  const messageId = ctx.callbackQuery?.message?.message_id;
  if (messageId !== undefined) {
    startAutoRefresh(chatId, messageId, telegramId, lang);
  }
}
