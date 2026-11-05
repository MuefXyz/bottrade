import { Context } from 'grammy';
import { parseMode } from '../config.js';
import { t, type Lang } from '../i18n.js';
import { mainMenuKeyboard } from '../keyboards/mainMenu.js';
import { saveWelcomeMessage, setUserLanguage } from '../services/userService.js';
import { buildWelcomeText } from './start.js';
import { safeAnswerCallbackQuery } from '../utils/telegram.js';

const SUPPORTED_LANGS: readonly string[] = ['id', 'en'];
const AUTO_DELETE_MS = 5000;

export async function languageCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const lang = ctx.callbackQuery?.data?.split(':')[1];

  if (chatId === undefined || lang === undefined || !SUPPORTED_LANGS.includes(lang)) {
    await safeAnswerCallbackQuery(ctx, { text: 'Bahasa tidak valid', show_alert: true });
    return;
  }

  const selected = lang as Lang;
  const telegramId = String(chatId);
  const user = await setUserLanguage(telegramId, selected);
  await safeAnswerCallbackQuery(ctx, { text: t(selected, 'statusUpdated') });

  // Pesan picker bahasa tidak diperlukan lagi.
  await ctx.deleteMessage().catch(() => undefined);

  // Edit welcome /start yang lama ke bahasa baru (bila masih ada).
  const welcomeEdited = await editWelcomeMessage(ctx, chatId, user.welcomeMessageId, selected);

  if (welcomeEdited) {
    // Keyboard baru dikirim lewat pesan status singkat, lalu auto-delete.
    const status = await ctx.reply(t(selected, 'languageChanged'), {
      parse_mode: parseMode(),
      reply_markup: mainMenuKeyboard(selected),
    });

    setTimeout(() => {
      void ctx.api
        .deleteMessage(status.chat.id, status.message_id)
        .catch(() => undefined);
    }, AUTO_DELETE_MS);
    return;
  }

  // Fallback: belum ada welcome sebelumnya, kirim welcome baru.
  const sent = await ctx.reply(buildWelcomeText(selected), {
    parse_mode: parseMode(),
    reply_markup: mainMenuKeyboard(selected),
  });

  await saveWelcomeMessage(telegramId, sent.message_id);
}

async function editWelcomeMessage(
  ctx: Context,
  chatId: number,
  welcomeMessageId: number | null,
  lang: Lang,
): Promise<boolean> {
  if (welcomeMessageId === null) return false;

  try {
    await ctx.api.editMessageText(chatId, welcomeMessageId, buildWelcomeText(lang), {
      parse_mode: parseMode(),
    });
    return true;
  } catch {
    return false;
  }
}
