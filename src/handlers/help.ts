import { InputFile, type Context } from 'grammy';
import { fileURLToPath } from 'node:url';
import { parseMode } from '../config.js';
import { normalizeLang, t } from '../i18n.js';
import { helpInlineKeyboard } from '../keyboards/mainMenu.js';
import { getOrCreateUser } from '../services/userService.js';
import { adminChatUrl } from '../utils/admin.js';

/** Lokasi PDF panduan, aman untuk `src/` maupun hasil build di `dist/`. */
export const USER_GUIDE_PDF = fileURLToPath(
  new URL('../../docs/Panduan-Penggunaan-PumpHunter-Bot.pdf', import.meta.url),
);

/**
 * Bantuan sederhana + tombol admin + panduan PDF.
 * Kalau PDF gagal dikirim, teks bantuan tetap terkirim.
 */
export async function helpCommand(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const user = await getOrCreateUser(String(chatId), ctx.from?.username);
  const lang = normalizeLang(user.language);
  const keyboard = helpInlineKeyboard(lang, adminChatUrl());

  await ctx.reply(t(lang, 'help'), {
    parse_mode: parseMode(),
    ...(keyboard === undefined ? {} : { reply_markup: keyboard }),
  });

  try {
    await ctx.replyWithDocument(new InputFile(USER_GUIDE_PDF), {
      caption: t(lang, 'helpGuideCaption'),
    });
  } catch (error) {
    console.error(
      '❌ [help] gagal mengirim PDF panduan:',
      error instanceof Error ? error.message : error,
    );
  }
}
