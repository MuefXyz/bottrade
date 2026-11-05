import { Context } from 'grammy';
import { parseMode } from '../config.js';
import { normalizeLang, t, type Lang } from '../i18n.js';
import { privateKeyInlineKeyboard, walletConfirmKeyboard } from '../keyboards/mainMenu.js';
import { getOrCreateUser, saveUserWallet } from '../services/userService.js';
import { generateWallet, privateKeyFromEncrypted } from '../services/walletService.js';
import { safeAnswerCallbackQuery, safeEditMessageText } from '../utils/telegram.js';

export async function walletCreateHandler(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const user = await getOrCreateUser(String(chatId), ctx.from?.username);
  const lang = normalizeLang(user.language);

  if (ctx.callbackQuery) await safeAnswerCallbackQuery(ctx);

  if (user.walletAddress) {
    await ctx.reply(t(lang, 'walletExists'), {
      parse_mode: parseMode(),
      reply_markup: walletConfirmKeyboard(lang),
    });
    return;
  }

  await createWallet(ctx, String(chatId), lang);
}

export async function walletConfirmHandler(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const user = await getOrCreateUser(String(chatId), ctx.from?.username);
  await safeAnswerCallbackQuery(ctx);
  await createWallet(ctx, String(chatId), normalizeLang(user.language));
}

export async function walletCancelHandler(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const user = await getOrCreateUser(String(chatId), ctx.from?.username);
  const lang = normalizeLang(user.language);

  await safeAnswerCallbackQuery(ctx);
  await safeEditMessageText(ctx, t(lang, 'walletCancelled'), {
    parse_mode: parseMode(),
  });
}

export async function walletPrivateKeyHandler(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const user = await getOrCreateUser(String(chatId), ctx.from?.username);
  const lang = normalizeLang(user.language);

  if (!user.walletAddress || !user.encryptedPrivateKey) {
    await safeAnswerCallbackQuery(ctx, { text: t(lang, 'noWallet'), show_alert: true });
    return;
  }

  let privateKey: string;
  try {
    privateKey = privateKeyFromEncrypted(user.encryptedPrivateKey);
  } catch {
    await safeAnswerCallbackQuery(ctx, {
      text: t(lang, 'privateKeyError'),
      show_alert: true,
    });
    return;
  }

  await safeAnswerCallbackQuery(ctx);
  await safeEditMessageText(
    ctx,
    [
      t(lang, 'walletDetailTitle'),
      '',
      `${t(lang, 'walletAddress')}:`,
      `\`${user.walletAddress}\``,
      '',
      `${t(lang, 'walletPrivateKey')}:`,
      `\`${privateKey}\``,
      '',
      t(lang, 'walletWarning'),
    ].join('\n'),
    {
      parse_mode: parseMode(),
      reply_markup: privateKeyInlineKeyboard(lang),
    },
  );
}

async function createWallet(ctx: Context, telegramId: string, lang: Lang): Promise<void> {
  const wallet = generateWallet();
  await saveUserWallet(telegramId, wallet.publicKey, wallet.encryptedPrivateKey);

  await ctx.reply(
    [
      t(lang, 'walletCreated'),
      '',
      `${t(lang, 'walletAddress')}:`,
      `\`${wallet.publicKey}\``,
      '',
      `${t(lang, 'walletPrivateKey')}:`,
      `\`${wallet.privateKey}\``,
      '',
      t(lang, 'walletWarning'),
    ].join('\n'),
    { parse_mode: parseMode() },
  );
}
