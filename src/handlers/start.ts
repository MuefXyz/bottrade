import { Context } from 'grammy';
import { BOT_NAME, parseMode } from '../config.js';
import { normalizeLang, t, type Lang } from '../i18n.js';
import { mainMenuKeyboard } from '../keyboards/mainMenu.js';
import { getOrCreateUser, saveWelcomeMessage } from '../services/userService.js';
import { stopPositionsAutoRefresh } from './positions.js';

export function buildWelcomeText(lang: Lang): string {
  return [
    `${t(lang, 'welcomeTitle')} *${BOT_NAME}*`,
    '',
    t(lang, 'disclaimer'),
    '',
    t(lang, 'chooseMenu'),
  ].join('\n');
}

export async function startCommand(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const telegramId = String(chatId);
  const user = await getOrCreateUser(telegramId, ctx.from?.username);
  const lang = normalizeLang(user.language);

  stopPositionsAutoRefresh(chatId);

  const sent = await ctx.reply(buildWelcomeText(lang), {
    parse_mode: parseMode(),
    reply_markup: mainMenuKeyboard(lang),
  });

  await saveWelcomeMessage(telegramId, sent.message_id);
}
