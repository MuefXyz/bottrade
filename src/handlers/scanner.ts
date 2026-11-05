import { Context } from 'grammy';
import { parseMode } from '../config.js';
import { normalizeLang, t, type Lang } from '../i18n.js';
import { scannerInlineKeyboard } from '../keyboards/mainMenu.js';
import { scanner } from '../scanner/index.js';
import { scannerNotifier } from '../scanner/notifier.js';
import { toScannerFilter } from '../scanner/settings.js';
import type { ScannerConfig } from '../scanner/config.js';
import type { ScannerStatus } from '../scanner/scanner.js';
import type { ScannerFilter } from '../scanner/types.js';
import { getScannerSettings } from '../services/scannerSettingsService.js';
import { getOrCreateUser } from '../services/userService.js';
import { safeAnswerCallbackQuery, safeEditMessageText } from '../utils/telegram.js';
import { cancelPendingScannerBuy } from './scannerBuy.js';

function formatPausedUntil(lang: Lang, pausedUntil: number): string {
  return new Date(pausedUntil).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMinutesValue(ms: number): string {
  const minutes = ms / 60_000;
  return Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
}

function statusText(lang: Lang, status: ScannerStatus): string {
  if (!status.subscribed) return t(lang, 'scanStatusStopped');

  if (status.pausedUntil !== null && Date.now() < status.pausedUntil) {
    return `${t(lang, 'scanStatusPaused')} ${formatPausedUntil(lang, status.pausedUntil)}`;
  }

  return t(lang, 'scanStatusRunning');
}

function panelText(
  lang: Lang,
  status: ScannerStatus,
  config: ScannerConfig,
  filter: ScannerFilter,
): string {
  const lines = [
    t(lang, 'scanPanelTitle'),
    '',
    `${t(lang, 'scanStatus')}: ${statusText(lang, status)}`,
    `${t(lang, 'scanWatching')}: ${status.watching}`,
    `${t(lang, 'scanSeen')}: ${status.tokensSeen}`,
    `${t(lang, 'scanAlerts')}: ${status.alertsSent}`,
    `${t(lang, 'scanUsers')}: ${status.subscribers}`,
    '',
    `${t(lang, 'scanMinDevBuy')}: ${filter.minDevBuySol} SOL`,
    `${t(lang, 'scanWindow')}: ${formatMinutesValue(filter.windowMs)} ${t(lang, 'scanMinutes')}`,
    `${t(lang, 'scanMinMcap')}: $${filter.minMarketCapUsd.toLocaleString('en-US')}`,
    `${t(lang, 'scanPause')}: ${formatMinutesValue(filter.pauseMs)} ${t(lang, 'scanMinutes')}`,
  ];

  if (!config.enabled) {
    lines.push('', t(lang, 'scanDisabled'));
  } else if (config.apiKey === null) {
    lines.push('', t(lang, 'scanNoApiKey'));
  }

  if (status.lastError) {
    lines.push('', `⚠️ ${status.lastError}`);
  }

  return lines.join('\n');
}

async function resolveLang(ctx: Context): Promise<Lang | null> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return null;

  const user = await getOrCreateUser(String(chatId), ctx.from?.username);
  return normalizeLang(user.language);
}

function panelView(lang: Lang, chatId: number) {
  const status = scanner.getStatus(chatId);
  return {
    text: panelText(lang, status, scanner.getConfig(), scanner.getFilter(chatId)),
    keyboard: scannerInlineKeyboard(lang, status.subscribed),
  };
}

async function editPanel(ctx: Context, lang: Lang, chatId: number): Promise<void> {
  const { text, keyboard } = panelView(lang, chatId);

  const messageId = ctx.callbackQuery?.message?.message_id;
  if (messageId !== undefined) {
    // Pesan panel ini yang akan di-edit saat alert masuk (bukan pesan baru).
    scannerNotifier.registerMessage(chatId, messageId);
  }

  await safeEditMessageText(ctx, text, { parse_mode: parseMode(), reply_markup: keyboard });
}

/**
 * Dibuka dari Menu Utama: kirim panel sebagai pesan baru agar pesan Menu Utama
 * tetap utuh. Pesan panel inilah yang nanti di-edit oleh alert.
 */
export async function scannerOpenHandler(ctx: Context): Promise<void> {
  const lang = await resolveLang(ctx);
  const chatId = ctx.chat?.id;
  if (lang === null || chatId === undefined) return;

  await safeAnswerCallbackQuery(ctx);

  // Tampilkan filter milik user, bukan default global.
  const settings = await getScannerSettings(
    String(chatId),
    scanner.getConfig(),
  );
  scanner.setFilter(chatId, toScannerFilter(settings));

  const { text, keyboard } = panelView(lang, chatId);
  const sent = await ctx.reply(text, { parse_mode: parseMode(), reply_markup: keyboard });
  scannerNotifier.registerMessage(chatId, sent.message_id);
}

export async function scannerStartHandler(ctx: Context): Promise<void> {
  const lang = await resolveLang(ctx);
  const chatId = ctx.chat?.id;
  if (lang === null || chatId === undefined) return;

  // Muat filter scanner milik user sebelum langganan dimulai.
  const settings = await getScannerSettings(
    String(chatId),
    scanner.getConfig(),
  );
  scanner.setFilter(chatId, toScannerFilter(settings));

  const result = scanner.start(chatId);

  await safeAnswerCallbackQuery(ctx, {
    text: result.ok ? t(lang, 'scanStarted') : t(lang, 'scanDisabled'),
    show_alert: !result.ok,
  });
  await editPanel(ctx, lang, chatId);
}

export async function scannerStopHandler(ctx: Context): Promise<void> {
  const lang = await resolveLang(ctx);
  const chatId = ctx.chat?.id;
  if (lang === null || chatId === undefined) return;

  scanner.stop(chatId);

  // Stop = hapus pesan notifikasi/panel + prompt buy yang masih terbuka.
  await cancelPendingScannerBuy(ctx, chatId);
  await scannerNotifier.deleteMessage(chatId);
  await safeAnswerCallbackQuery(ctx, { text: t(lang, 'scanStopped') });
}

/** Tombol Tutup: hapus panel scanner kalau user tidak jadi memulai scan. */
export async function scannerDismissHandler(ctx: Context): Promise<void> {
  const lang = await resolveLang(ctx);
  const chatId = ctx.chat?.id;
  if (lang === null || chatId === undefined) return;

  await cancelPendingScannerBuy(ctx, chatId);

  // Panel lama bisa saja menampilkan status stopped padahal scan sedang jalan.
  if (scanner.getStatus(chatId).subscribed) {
    scanner.stop(chatId);
  }

  await safeAnswerCallbackQuery(ctx);
  await scannerNotifier.deleteMessage(chatId);
  await ctx.deleteMessage().catch(() => undefined);
}
