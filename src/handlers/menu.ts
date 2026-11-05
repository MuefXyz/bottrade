import { Context } from 'grammy';
import { parseMode } from '../config.js';
import { normalizeLang, t } from '../i18n.js';
import {
  detailInlineKeyboard,
  languageKeyboard,
  mainMenuInlineKeyboard,
  menuActionFor,
  walletDetailInlineKeyboard,
} from '../keyboards/mainMenu.js';
import { getOrCreateUser } from '../services/userService.js';
import {
  formatSol,
  getWalletBalanceLamports,
} from '../services/walletBalanceService.js';
import { escapeMarkdown } from '../utils/markdown.js';
import { safeAnswerCallbackQuery, safeEditMessageText } from '../utils/telegram.js';
import { helpCommand } from './help.js';
import { stopPositionsAutoRefresh } from './positions.js';
import { walletCreateHandler } from './wallet.js';

export async function menuTextHandler(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  const chatId = ctx.chat?.id;
  if (text === undefined || chatId === undefined) return;

  // Meninggalkan panel Posisi Terbuka lewat reply keyboard.
  stopPositionsAutoRefresh(chatId);

  const user = await getOrCreateUser(String(chatId), ctx.from?.username);
  const lang = normalizeLang(user.language);

  switch (menuActionFor(text)) {
    case 'help':
      await helpCommand(ctx);
      return;
    case 'language':
      await ctx.reply(t(lang, 'chooseLanguage'), {
        reply_markup: languageKeyboard(),
      });
      return;
    case 'wallet':
      await walletCreateHandler(ctx);
      return;
    case 'main':
      await ctx.reply(t(lang, 'menuMain'), {
        parse_mode: parseMode(),
        reply_markup: mainMenuInlineKeyboard(lang),
      });
      return;
    default:
      return;
  }
}

export async function profileHandler(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const user = await getOrCreateUser(String(chatId), ctx.from?.username);
  const lang = normalizeLang(user.language);
  const username = user.username ? `@${escapeMarkdown(user.username)}` : '-';

  await safeAnswerCallbackQuery(ctx);
  await safeEditMessageText(
    ctx,
    [
      t(lang, 'profileTitle'),
      '',
      `🆔 Telegram ID: \`${user.telegramId}\``,
      `👤 Username: ${username}`,
      `${t(lang, 'language')}: ${lang === 'id' ? 'Indonesia' : 'English'}`,
    ].join('\n'),
    { parse_mode: parseMode(), reply_markup: detailInlineKeyboard(lang) },
  );
}

export async function walletDetailHandler(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const user = await getOrCreateUser(String(chatId), ctx.from?.username);
  const lang = normalizeLang(user.language);

  await safeAnswerCallbackQuery(ctx);

  let text: string;
  let keyboard: ReturnType<typeof walletDetailInlineKeyboard>;

  if (user.walletAddress) {
    const lamports = await getWalletBalanceLamports(user.walletAddress);
    const balance =
      lamports === null
        ? t(lang, 'walletBalanceUnavailable')
        : formatSol(lamports, 4);

    text = [
      t(lang, 'walletDetailTitle'),
      '',
      `${t(lang, 'walletAddress')}:`,
      `\`${user.walletAddress}\``,
      '',
      `${t(lang, 'walletBalanceLabel')}: ${balance}`,
    ].join('\n');
    keyboard = walletDetailInlineKeyboard(lang);
  } else {
    text = t(lang, 'noWallet');
    keyboard = detailInlineKeyboard(lang);
  }

  await safeEditMessageText(ctx, text, {
    parse_mode: parseMode(),
    reply_markup: keyboard,
  });
}

export async function mainMenuHandler(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  // Tombol Back dari panel Posisi Terbuka.
  stopPositionsAutoRefresh(chatId);

  const user = await getOrCreateUser(String(chatId), ctx.from?.username);
  const lang = normalizeLang(user.language);

  await safeAnswerCallbackQuery(ctx);
  await safeEditMessageText(ctx, t(lang, 'menuMain'), {
    parse_mode: parseMode(),
    reply_markup: mainMenuInlineKeyboard(lang),
  });
}
