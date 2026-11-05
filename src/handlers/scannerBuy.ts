import { Context } from 'grammy';
import { parseMode } from '../config.js';
import { copyTrade } from '../copyTrade/index.js';
import { parseSolAmount } from '../copyTrade/settings.js';
import { normalizeLang, t, type Lang } from '../i18n.js';
import {
  menuActionFor,
  scannerBuyPromptKeyboard,
  scannerBuyResultKeyboard,
} from '../keyboards/mainMenu.js';
import { formatBuyResult } from '../scanner/format.js';
import { getCopyTradeSettings } from '../services/copyTradeSettingsService.js';
import { getOrCreateUser } from '../services/userService.js';
import { editOrSendMessage } from '../utils/messageEditor.js';
import { safeAnswerCallbackQuery } from '../utils/telegram.js';

interface PendingBuy {
  mint: string;
  promptMessageId: number;
}

/** Chat yang sedang menunggu input nominal buy dari alert scanner. */
const pendingBuys = new Map<number, PendingBuy>();

const MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function buyPrompt(lang: Lang, mint: string, defaultAmount: number): string {
  return t(lang, 'scanBuyPrompt')
    .replace('{mint}', mint)
    .replace('{amount}', String(defaultAmount));
}

/**
 * Tombol Buy di alert Scanner Token.
 * Buy bersifat manual: nominal selalu diminta lewat pesan teks.
 */
export async function scannerBuyHandler(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const data = ctx.callbackQuery?.data ?? '';
  const action = data.slice('scan:buy:'.length);

  if (action === 'cancel') {
    const pending = pendingBuys.get(chatId);
    pendingBuys.delete(chatId);
    await safeAnswerCallbackQuery(ctx);
    if (pending !== undefined) {
      await ctx.api.deleteMessage(chatId, pending.promptMessageId).catch(() => undefined);
    }
    return;
  }

  if (action === 'dismiss') {
    await safeAnswerCallbackQuery(ctx);
    await ctx.deleteMessage().catch(() => undefined);
    return;
  }

  const telegramId = String(chatId);
  const user = await getOrCreateUser(telegramId, ctx.from?.username);
  const lang = normalizeLang(user.language);
  const config = copyTrade.getConfig();

  if (!MINT_PATTERN.test(action)) {
    await safeAnswerCallbackQuery(ctx, {
      text: t(lang, 'scanBuyFailedTitle'),
      show_alert: true,
    });
    return;
  }

  if (!config.enabled) {
    await safeAnswerCallbackQuery(ctx, {
      text: t(lang, 'copyDisabled'),
      show_alert: true,
    });
    return;
  }

  // Hanya satu prompt buy aktif per chat.
  const previous = pendingBuys.get(chatId);
  if (previous !== undefined) {
    await ctx.api.deleteMessage(chatId, previous.promptMessageId).catch(() => undefined);
    pendingBuys.delete(chatId);
  }

  await safeAnswerCallbackQuery(ctx);

  const settings = await getCopyTradeSettings(telegramId, config);
  const sent = await ctx.reply(buyPrompt(lang, action, settings.amountSol), {
    parse_mode: parseMode(),
    reply_markup: scannerBuyPromptKeyboard(lang),
  });

  pendingBuys.set(chatId, { mint: action, promptMessageId: sent.message_id });
}

/** Middleware input nominal buy dari alert scanner. */
export async function scannerBuyTextHandler(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;
  if (chatId === undefined || text === undefined) return false;

  const pending = pendingBuys.get(chatId);
  if (pending === undefined) return false;

  // Jangan telan tombol menu reply keyboard.
  if (menuActionFor(text) !== undefined) {
    pendingBuys.delete(chatId);
    return false;
  }

  const telegramId = String(chatId);
  const user = await getOrCreateUser(telegramId, ctx.from?.username);
  const lang = normalizeLang(user.language);

  await ctx.deleteMessage().catch(() => undefined);

  const amount = parseSolAmount(text);

  if (amount === null) {
    const settings = await getCopyTradeSettings(telegramId, copyTrade.getConfig());
    const result = await editOrSendMessage(
      ctx.api,
      chatId,
      pending.promptMessageId,
      `${buyPrompt(lang, pending.mint, settings.amountSol)}\n\n${t(
        lang,
        'copyAmountInvalid',
      )}`,
      {
        parse_mode: parseMode(),
        reply_markup: scannerBuyPromptKeyboard(lang),
      },
    );
    pendingBuys.set(chatId, { ...pending, promptMessageId: result.messageId });
    return true;
  }

  pendingBuys.delete(chatId);

  const processing = await editOrSendMessage(
    ctx.api,
    chatId,
    pending.promptMessageId,
    t(lang, 'scanBuyProcessing'),
    { parse_mode: parseMode() },
  );

  const result = await copyTrade.buyManually(chatId, pending.mint, amount);

  await editOrSendMessage(
    ctx.api,
    chatId,
    processing.messageId,
    formatBuyResult(result, lang),
    {
      parse_mode: parseMode(),
      reply_markup: scannerBuyResultKeyboard(lang),
    },
  );

  return true;
}

/** Hapus prompt buy yang masih terbuka saat scanner dihentikan. */
export async function cancelPendingScannerBuy(
  ctx: Context,
  chatId: number,
): Promise<void> {
  const pending = pendingBuys.get(chatId);
  if (pending === undefined) return;

  pendingBuys.delete(chatId);
  await ctx.api.deleteMessage(chatId, pending.promptMessageId).catch(() => undefined);
}
