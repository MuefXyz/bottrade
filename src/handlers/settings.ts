import { Context } from 'grammy';
import { parseMode } from '../config.js';
import { copyTrade } from '../copyTrade/index.js';
import {
  parseAgeMinutes,
  parsePnlPercent,
  parsePositionCount,
  parsePriorityFee,
  parseSlippagePct,
  parseSolAmount,
} from '../copyTrade/settings.js';
import { normalizeLang, t, type Lang, type MessageKey } from '../i18n.js';
import {
  menuActionFor,
  settingsCancelKeyboard,
  settingsInlineKeyboard,
} from '../keyboards/mainMenu.js';
import { scanner } from '../scanner/index.js';
import { parseScannerNumber, toScannerFilter } from '../scanner/settings.js';
import {
  getCopyTradeSettings,
  setCopyTradeSetting,
  type CopyTradeSettings,
} from '../services/copyTradeSettingsService.js';
import {
  getScannerSettings,
  setScannerSetting,
} from '../services/scannerSettingsService.js';
import { getOrCreateUser } from '../services/userService.js';
import { editOrSendMessage } from '../utils/messageEditor.js';
import { safeAnswerCallbackQuery, safeEditMessageText } from '../utils/telegram.js';

type SettingsKind =
  | 'amount'
  | 'tp'
  | 'sl'
  | 'maxpos'
  | 'maxage'
  | 'slippage'
  | 'fee'
  | 'mcap'
  | 'devbuy'
  | 'window'
  | 'pause';

type ScannerSettingKind = Extract<SettingsKind, 'mcap' | 'devbuy' | 'window' | 'pause'>;
type CopySettingKind = Exclude<SettingsKind, ScannerSettingKind>;

interface PendingSettingsInput {
  messageId: number;
  kind: SettingsKind;
}

/** Chat yang sedang menunggu input pengaturan. */
const pendingInputs = new Map<number, PendingSettingsInput>();

interface SettingsContext {
  chatId: number;
  telegramId: string;
  lang: Lang;
}

const COPY_SETTING_KEY: Record<CopySettingKind, keyof CopyTradeSettings> = {
  amount: 'amountSol',
  tp: 'takeProfitPct',
  sl: 'stopLossPct',
  maxpos: 'maxPositions',
  maxage: 'maxAgeMinutes',
  slippage: 'slippagePct',
  fee: 'priorityFeeSol',
};

const SCANNER_SETTING_KEY: Record<
  ScannerSettingKind,
  'minMarketCapUsd' | 'minDevBuySol' | 'windowMinutes' | 'pauseMinutes'
> = {
  mcap: 'minMarketCapUsd',
  devbuy: 'minDevBuySol',
  window: 'windowMinutes',
  pause: 'pauseMinutes',
};

async function resolveContext(ctx: Context): Promise<SettingsContext | null> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return null;

  const telegramId = String(chatId);
  const user = await getOrCreateUser(telegramId, ctx.from?.username);

  return { chatId, telegramId, lang: normalizeLang(user.language) };
}

function isScannerKind(kind: SettingsKind): kind is ScannerSettingKind {
  return kind === 'mcap' || kind === 'devbuy' || kind === 'window' || kind === 'pause';
}

function promptKeyFor(kind: SettingsKind): MessageKey {
  switch (kind) {
    case 'amount':
      return 'copyAmountPrompt';
    case 'tp':
      return 'copyTpPrompt';
    case 'sl':
      return 'copySlPrompt';
    case 'maxpos':
      return 'settingsMaxPositionsPrompt';
    case 'maxage':
      return 'settingsMaxAgePrompt';
    case 'slippage':
      return 'settingsSlippagePrompt';
    case 'fee':
      return 'settingsPriorityFeePrompt';
    case 'mcap':
      return 'settingsMcapPrompt';
    case 'devbuy':
      return 'settingsDevBuyPrompt';
    case 'window':
      return 'settingsWindowPrompt';
    case 'pause':
      return 'settingsPausePrompt';
  }
}

function invalidKeyFor(kind: SettingsKind): MessageKey {
  if (kind === 'amount') return 'copyAmountInvalid';
  if (kind === 'tp' || kind === 'sl') return 'copyPercentInvalid';
  if (kind === 'maxpos') return 'settingsMaxPositionsInvalid';
  if (kind === 'slippage') return 'settingsSlippageInvalid';
  if (kind === 'fee') return 'settingsPriorityFeeInvalid';
  return 'settingsNumberInvalid';
}

function parseValue(kind: SettingsKind, text: string): number | null {
  switch (kind) {
    case 'amount':
      return parseSolAmount(text);
    case 'tp':
    case 'sl':
      return parsePnlPercent(text);
    case 'maxpos':
      return parsePositionCount(text);
    case 'maxage':
      return parseAgeMinutes(text);
    case 'slippage':
      return parseSlippagePct(text);
    case 'fee':
      return parsePriorityFee(text);
    default:
      return parseScannerNumber(text);
  }
}

function formatTp(lang: Lang, takeProfitPct: number): string {
  return takeProfitPct > 0 ? `+${takeProfitPct}%` : t(lang, 'copyTpOff');
}

function formatSl(lang: Lang, stopLossPct: number): string {
  return stopLossPct > 0 ? `-${stopLossPct}%` : t(lang, 'copySlOff');
}

function formatMcap(value: number): string {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatMinutes(lang: Lang, value: number): string {
  return `${value} ${t(lang, 'scanMinutes')}`;
}

function formatAge(lang: Lang, value: number): string {
  return value > 0
    ? `${value} ${t(lang, 'scanMinutes')}`
    : t(lang, 'settingsOff');
}

function formatPositions(lang: Lang, value: number): string {
  return `${value} ${t(lang, 'settingsPositionsUnit')}`;
}

async function settingsView(
  lang: Lang,
  telegramId: string,
  notice?: string,
): Promise<{ text: string; keyboard: ReturnType<typeof settingsInlineKeyboard> }> {
  const copySettings = await getCopyTradeSettings(
    telegramId,
    copyTrade.getConfig(),
  );
  const scanSettings = await getScannerSettings(
    telegramId,
    scanner.getConfig(),
  );

  const lines = [
    t(lang, 'settingsTitle'),
    '',
    `${t(lang, 'copyAmountLabel')}: ${copySettings.amountSol} SOL`,
    `${t(lang, 'copyTpLabel')}: ${formatTp(lang, copySettings.takeProfitPct)}`,
    `${t(lang, 'copySlLabel')}: ${formatSl(lang, copySettings.stopLossPct)}`,
    '',
    t(lang, 'settingsRiskSection'),
    `${t(lang, 'settingsMaxPositionsLabel')}: ${formatPositions(
      lang,
      copySettings.maxPositions,
    )}`,
    `${t(lang, 'settingsMaxAgeLabel')}: ${formatAge(
      lang,
      copySettings.maxAgeMinutes,
    )}`,
    `${t(lang, 'settingsSlippageLabel')}: ${copySettings.slippagePct}%`,
    `${t(lang, 'settingsPriorityFeeLabel')}: ${copySettings.priorityFeeSol} SOL`,
    '',
    t(lang, 'settingsScannerSection'),
    `${t(lang, 'settingsMinMcapLabel')}: ${formatMcap(
      scanSettings.minMarketCapUsd,
    )}`,
    `${t(lang, 'settingsMinDevBuyLabel')}: ${scanSettings.minDevBuySol} SOL`,
    `${t(lang, 'settingsWindowLabel')}: ${formatMinutes(
      lang,
      scanSettings.windowMinutes,
    )}`,
    `${t(lang, 'settingsPauseLabel')}: ${formatMinutes(
      lang,
      scanSettings.pauseMinutes,
    )}`,
    '',
    t(lang, 'settingsDesc'),
  ];

  if (notice) lines.push('', notice);

  return { text: lines.join('\n'), keyboard: settingsInlineKeyboard(lang) };
}

/** Buka panel Pengaturan terpusat dari Menu Utama. */
export async function settingsOpenHandler(ctx: Context): Promise<void> {
  const context = await resolveContext(ctx);
  if (context === null) return;

  pendingInputs.delete(context.chatId);
  await safeAnswerCallbackQuery(ctx);

  const { text, keyboard } = await settingsView(
    context.lang,
    context.telegramId,
  );
  await safeEditMessageText(ctx, text, {
    parse_mode: parseMode(),
    reply_markup: keyboard,
  });
}

/**
 * Tombol lama di panel Scanning Wallet (`copy:amount` / `copy:tp` / `copy:sl`)
 * diarahkan ke panel Pengaturan terpusat.
 */
export async function settingsLegacyRedirectHandler(
  ctx: Context,
): Promise<void> {
  await settingsOpenHandler(ctx);
}

async function beginInput(
  ctx: Context,
  kind: SettingsKind,
): Promise<void> {
  const context = await resolveContext(ctx);
  if (context === null) return;

  const promptKey = promptKeyFor(kind);
  const messageId = ctx.callbackQuery?.message?.message_id;
  if (messageId === undefined) {
    await safeAnswerCallbackQuery(ctx, { text: t(context.lang, promptKey) });
    return;
  }

  pendingInputs.set(context.chatId, { messageId, kind });
  await safeAnswerCallbackQuery(ctx);
  await safeEditMessageText(ctx, t(context.lang, promptKey), {
    parse_mode: parseMode(),
    reply_markup: settingsCancelKeyboard(context.lang),
  });
}

export async function settingsSetAmountHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'amount');
}

export async function settingsSetTpHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'tp');
}

export async function settingsSetSlHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'sl');
}

export async function settingsSetMaxPositionsHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'maxpos');
}

export async function settingsSetMaxAgeHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'maxage');
}

export async function settingsSetSlippageHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'slippage');
}

export async function settingsSetFeeHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'fee');
}

export async function settingsSetMcapHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'mcap');
}

export async function settingsSetDevBuyHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'devbuy');
}

export async function settingsSetWindowHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'window');
}

export async function settingsSetPauseHandler(ctx: Context): Promise<void> {
  await beginInput(ctx, 'pause');
}

/** Batal mengisi nilai: kembali ke panel Pengaturan tanpa mengubah apa pun. */
export async function settingsCancelHandler(ctx: Context): Promise<void> {
  const context = await resolveContext(ctx);
  if (context === null) return;

  pendingInputs.delete(context.chatId);
  await safeAnswerCallbackQuery(ctx);

  const { text, keyboard } = await settingsView(
    context.lang,
    context.telegramId,
  );
  await safeEditMessageText(ctx, text, {
    parse_mode: parseMode(),
    reply_markup: keyboard,
  });
}

function savedNotice(
  lang: Lang,
  kind: SettingsKind,
  value: number,
): string {
  switch (kind) {
    case 'amount':
      return t(lang, 'copyAmountSaved').replace('{value}', String(value));
    case 'tp':
    case 'sl':
      return t(lang, 'copyPercentSaved').replace('{value}', String(value));
    case 'maxpos':
      return t(lang, 'settingsNumberSaved').replace(
        '{value}',
        formatPositions(lang, value),
      );
    case 'maxage':
      return t(lang, 'settingsNumberSaved').replace(
        '{value}',
        formatAge(lang, value),
      );
    case 'slippage':
      return t(lang, 'settingsNumberSaved').replace('{value}', `${value}%`);
    case 'fee':
      return t(lang, 'settingsNumberSaved').replace('{value}', `${value} SOL`);
    case 'mcap':
      return t(lang, 'settingsNumberSaved').replace('{value}', formatMcap(value));
    case 'devbuy':
      return t(lang, 'settingsNumberSaved').replace('{value}', `${value} SOL`);
    default:
      return t(lang, 'settingsNumberSaved').replace(
        '{value}',
        formatMinutes(lang, value),
      );
  }
}

/**
 * Middleware input teks pengaturan (nominal, TP/SL, risiko, filter scanner).
 * Return `true` bila pesan dikonsumsi (sedang menunggu input).
 */
export async function settingsTextHandler(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;
  if (chatId === undefined || text === undefined) return false;

  const pending = pendingInputs.get(chatId);
  if (pending === undefined) return false;

  // Jangan telan tombol menu reply keyboard.
  if (menuActionFor(text) !== undefined) {
    pendingInputs.delete(chatId);
    return false;
  }

  const context = await resolveContext(ctx);
  if (context === null) return true;

  const { kind } = pending;
  const promptKey = promptKeyFor(kind);
  const value = parseValue(kind, text);

  await ctx.deleteMessage().catch(() => undefined);

  if (value === null) {
    const result = await editOrSendMessage(
      ctx.api,
      chatId,
      pending.messageId,
      `${t(context.lang, promptKey)}\n\n${t(context.lang, invalidKeyFor(kind))}`,
      {
        parse_mode: parseMode(),
        reply_markup: settingsCancelKeyboard(context.lang),
      },
    );
    pendingInputs.set(chatId, { ...pending, messageId: result.messageId });
    return true;
  }

  if (isScannerKind(kind)) {
    await setScannerSetting(
      context.telegramId,
      SCANNER_SETTING_KEY[kind],
      value,
    );

    // Terapkan langsung ke scanner yang sedang berjalan di chat ini.
    const latest = await getScannerSettings(
      context.telegramId,
      scanner.getConfig(),
    );
    scanner.setFilter(context.chatId, toScannerFilter(latest));
  } else {
    await setCopyTradeSetting(context.telegramId, COPY_SETTING_KEY[kind], value);
  }

  pendingInputs.delete(chatId);

  const { text: panelText, keyboard } = await settingsView(
    context.lang,
    context.telegramId,
    savedNotice(context.lang, kind, value),
  );
  await editOrSendMessage(ctx.api, chatId, pending.messageId, panelText, {
    parse_mode: parseMode(),
    reply_markup: keyboard,
  });

  return true;
}
