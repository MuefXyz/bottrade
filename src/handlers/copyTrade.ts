import { Context } from 'grammy';
import { parseMode } from '../config.js';
import { normalizeLang, t, type Lang } from '../i18n.js';
import {
  copyTradeAddKeyboard,
  copyTradeInlineKeyboard,
  menuActionFor,
  shortWalletAddress,
} from '../keyboards/mainMenu.js';
import { copyTrade } from '../copyTrade/index.js';
import { copyTradeNotifier } from '../copyTrade/notifier.js';
import { listOpenPositions } from '../services/copyPositionService.js';
import { getCopyTradeSettings } from '../services/copyTradeSettingsService.js';
import { getOrCreateUser } from '../services/userService.js';
import {
  addWatchedWallet,
  listWatchedWallets,
  MAX_WATCHED_WALLETS,
  removeWatchedWallet,
} from '../services/walletWatchService.js';
import { editOrSendMessage } from '../utils/messageEditor.js';
import { safeAnswerCallbackQuery, safeEditMessageText } from '../utils/telegram.js';

/** Chat yang sedang menunggu input alamat wallet. */
const pendingInputs = new Map<number, number>();

interface PanelContext {
  chatId: number;
  telegramId: string;
  lang: Lang;
}

async function resolvePanelContext(ctx: Context): Promise<PanelContext | null> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return null;

  const telegramId = String(chatId);
  const user = await getOrCreateUser(telegramId, ctx.from?.username);

  return { chatId, telegramId, lang: normalizeLang(user.language) };
}

function formatSl(lang: Lang, slPct: number): string {
  return slPct > 0 ? `-${slPct}%` : t(lang, 'copySlOff');
}

async function panelView(
  lang: Lang,
  telegramId: string,
  notice?: string,
): Promise<{ text: string; keyboard: ReturnType<typeof copyTradeInlineKeyboard> }> {
  const chatId = Number(telegramId);
  const status = copyTrade.getStatus(chatId);
  const config = copyTrade.getConfig();
  const wallets = await listWatchedWallets(telegramId);
  const positions = await listOpenPositions(telegramId);
  const settings = await getCopyTradeSettings(telegramId, config);

  const lines = [
    t(lang, 'copyPanelTitle'),
    '',
    `${t(lang, 'copyStatusLabel')}: ${
      status.subscribed ? t(lang, 'copyStatusRunning') : t(lang, 'copyStatusStopped')
    }`,
    `${t(lang, 'copyModeLabel')}: ${
      config.dryRun ? t(lang, 'copyModeDry') : t(lang, 'copyModeLive')
    }`,
    `${t(lang, 'copyWalletsLabel')}: ${wallets.length}/${MAX_WATCHED_WALLETS}`,
    `${t(lang, 'copyPositionsLabel')}: ${positions.length}`,
    '',
    `${t(lang, 'copyAmountLabel')}: ${settings.amountSol} SOL`,
    `${t(lang, 'copyTpLabel')}: ${
      settings.takeProfitPct > 0
        ? `+${settings.takeProfitPct}%`
        : t(lang, 'copyTpOff')
    } | ${t(lang, 'copySlLabel')}: ${formatSl(
      lang,
      settings.stopLossPct,
    )}`,
    t(lang, 'copySettingsForNextPositions'),
  ];

  if (wallets.length === 0) {
    lines.push('', t(lang, 'copyEmptyWallets'));
  } else {
    lines.push('');
    for (const wallet of wallets) {
      lines.push(`• \`${shortWalletAddress(wallet.address)}\``);
    }
  }

  if (!config.enabled) {
    lines.push('', t(lang, 'copyDisabled'));
  }

  if (notice) {
    lines.push('', notice);
  }

  return {
    text: lines.join('\n'),
    keyboard: copyTradeInlineKeyboard(lang, wallets, status.subscribed),
  };
}

async function editPanel(
  ctx: Context,
  context: PanelContext,
  notice?: string,
): Promise<void> {
  const { text, keyboard } = await panelView(
    context.lang,
    context.telegramId,
    notice,
  );

  await safeEditMessageText(ctx, text, {
    parse_mode: parseMode(),
    reply_markup: keyboard,
  });
}

export async function copyTradeOpenHandler(ctx: Context): Promise<void> {
  const context = await resolvePanelContext(ctx);
  if (context === null) return;

  await safeAnswerCallbackQuery(ctx);

  const { text, keyboard } = await panelView(context.lang, context.telegramId);
  await ctx.reply(text, { parse_mode: parseMode(), reply_markup: keyboard });
}

export async function copyTradeAddHandler(ctx: Context): Promise<void> {
  const context = await resolvePanelContext(ctx);
  if (context === null) return;

  const messageId = ctx.callbackQuery?.message?.message_id;
  if (messageId === undefined) {
    await safeAnswerCallbackQuery(ctx, { text: t(context.lang, 'copyAddPrompt') });
    return;
  }

  pendingInputs.set(context.chatId, messageId);
  await safeAnswerCallbackQuery(ctx);

  // Panel yang sama diubah menjadi prompt input (tanpa pesan baru).
  await safeEditMessageText(ctx, t(context.lang, 'copyAddPrompt'), {
    parse_mode: parseMode(),
    reply_markup: copyTradeAddKeyboard(context.lang),
  });
}

export async function copyTradeCancelHandler(ctx: Context): Promise<void> {
  const context = await resolvePanelContext(ctx);
  if (context === null) return;

  pendingInputs.delete(context.chatId);
  await safeAnswerCallbackQuery(ctx);
  await editPanel(ctx, context);
}

export async function copyTradeRemoveHandler(ctx: Context): Promise<void> {
  const context = await resolvePanelContext(ctx);
  if (context === null) return;

  const data = ctx.callbackQuery?.data ?? '';
  const address = data.startsWith('copy:rm:') ? data.slice('copy:rm:'.length) : '';
  if (address.length === 0) {
    await safeAnswerCallbackQuery(ctx);
    return;
  }

  await removeWatchedWallet(context.telegramId, address);

  const remaining = await listWatchedWallets(context.telegramId);
  if (remaining.length === 0) copyTrade.stop(context.chatId);

  await safeAnswerCallbackQuery(ctx, { text: t(context.lang, 'copyRemoveSuccess') });
  await editPanel(ctx, context);
}

export async function copyTradeStartHandler(ctx: Context): Promise<void> {
  const context = await resolvePanelContext(ctx);
  if (context === null) return;

  const wallets = await listWatchedWallets(context.telegramId);
  if (wallets.length === 0) {
    await safeAnswerCallbackQuery(ctx, {
      text: t(context.lang, 'copyNoWallets'),
      show_alert: true,
    });
    return;
  }

  const settings = await getCopyTradeSettings(
    context.telegramId,
    copyTrade.getConfig(),
  );
  if (settings.amountSol <= 0) {
    await safeAnswerCallbackQuery(ctx, {
      text: t(context.lang, 'copyErrorAmountUnset'),
      show_alert: true,
    });
    return;
  }

  const result = copyTrade.start(context.chatId);

  await safeAnswerCallbackQuery(ctx, {
    text: result.ok
      ? t(context.lang, 'copyStarted')
      : t(context.lang, 'copyDisabled'),
    show_alert: !result.ok,
  });
  await editPanel(ctx, context);
}

export async function copyTradeStopHandler(ctx: Context): Promise<void> {
  const context = await resolvePanelContext(ctx);
  if (context === null) return;

  pendingInputs.delete(context.chatId);
  copyTrade.stop(context.chatId);

  await safeAnswerCallbackQuery(ctx, { text: t(context.lang, 'copyStopped') });

  // Stop = hapus kedua pesan fitur ini: board live dan panel Scanning Wallet.
  await copyTradeNotifier.deleteMessage(context.chatId);
  await ctx.deleteMessage().catch(() => undefined);
}

/** Tombol Tutup: hapus panel kalau user tidak jadi memulai scan. */
export async function copyTradeDismissHandler(ctx: Context): Promise<void> {
  const context = await resolvePanelContext(ctx);
  if (context === null) return;

  pendingInputs.delete(context.chatId);

  // Panel lama bisa saja masih menampilkan status stopped padahal scan jalan.
  if (copyTrade.getStatus(context.chatId).subscribed) {
    copyTrade.stop(context.chatId);
  }

  await safeAnswerCallbackQuery(ctx);
  await copyTradeNotifier.deleteMessage(context.chatId);
  await ctx.deleteMessage().catch(() => undefined);
}

/** Tombol close per token di board live. */
export async function copyTradeCloseHandler(ctx: Context): Promise<void> {
  const context = await resolvePanelContext(ctx);
  if (context === null) return;

  const data = ctx.callbackQuery?.data ?? '';
  const positionId = Number(data.slice('copy:close:'.length));
  const result = await copyTrade.closeManually(context.chatId, positionId);

  if (result === 'closed') {
    await safeAnswerCallbackQuery(ctx, {
      text: t(context.lang, 'copyManualClosed'),
    });
    return;
  }

  if (result === 'busy') {
    await safeAnswerCallbackQuery(ctx, {
      text: t(context.lang, 'copyManualBusy'),
    });
    return;
  }

  await safeAnswerCallbackQuery(ctx, {
    text: t(
      context.lang,
      result === 'not_found' ? 'copyManualNotFound' : 'copyManualFailed',
    ),
    show_alert: true,
  });
}

/**
 * Middleware input teks alamat wallet.
 * Return `true` bila pesan dikonsumsi (sedang menunggu input).
 */
export async function copyTradeTextHandler(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;
  if (chatId === undefined || text === undefined) return false;

  const pendingMessageId = pendingInputs.get(chatId);
  if (pendingMessageId === undefined) return false;

  // Jangan telan tombol menu reply keyboard.
  if (menuActionFor(text) !== undefined) {
    pendingInputs.delete(chatId);
    return false;
  }

  const context = await resolvePanelContext(ctx);
  if (context === null) return true;

  const wallet = await addWatchedWallet(context.telegramId, text);

  // Hapus pesan alamat dari chat (privasi + tidak mengotori chat).
  await ctx.deleteMessage().catch(() => undefined);

  if (!wallet.ok) {
    const message =
      wallet.reason === 'invalid'
        ? t(context.lang, 'copyAddInvalid')
        : wallet.reason === 'limit'
          ? t(context.lang, 'copyAddLimit')
          : t(context.lang, 'copyAddDuplicate');

    if (wallet.reason === 'invalid') {
      const result = await editOrSendMessage(
        ctx.api,
        chatId,
        pendingMessageId,
        `${t(context.lang, 'copyAddPrompt')}\n\n${message}`,
        {
          parse_mode: parseMode(),
          reply_markup: copyTradeAddKeyboard(context.lang),
        },
      );
      pendingInputs.set(chatId, result.messageId);
      return true;
    }

    pendingInputs.delete(chatId);
    const { text: panelText, keyboard } = await panelView(
      context.lang,
      context.telegramId,
      message,
    );
    await editOrSendMessage(ctx.api, chatId, pendingMessageId, panelText, {
      parse_mode: parseMode(),
      reply_markup: keyboard,
    });

    return true;
  }

  pendingInputs.delete(chatId);

  const { text: panelText, keyboard } = await panelView(
    context.lang,
    context.telegramId,
    t(context.lang, 'copyAddSuccess'),
  );

  await editOrSendMessage(ctx.api, chatId, pendingMessageId, panelText, {
    parse_mode: parseMode(),
    reply_markup: keyboard,
  });

  return true;
}

export function isCopyTradeInputPending(chatId: number): boolean {
  return pendingInputs.has(chatId);
}
