import type { Api } from 'grammy';
import { isMessageNotModified } from './telegram.js';

type SendOptions = Parameters<Api['sendMessage']>[2];
type EditOptions = Parameters<Api['editMessageText']>[3];

export interface EditOrSendResult {
  messageId: number;
  edited: boolean;
}

/**
 * Edit pesan yang sudah terdaftar; kalau pesan hilang/tidak bisa diedit,
 * kirim pesan baru sebagai pengganti. Dipakai notifier scanner & copy-trade
 * agar keduanya tidak menduplikasi logika yang sama.
 */
export async function editOrSendMessage(
  api: Api,
  chatId: number,
  messageId: number | undefined,
  text: string,
  options: SendOptions,
): Promise<EditOrSendResult> {
  if (messageId !== undefined) {
    try {
      await api.editMessageText(chatId, messageId, text, options as EditOptions);
      return { messageId, edited: true };
    } catch (error) {
      if (isMessageNotModified(error)) return { messageId, edited: true };
      // Pesan lama sudah dihapus / bukan milik bot → kirim pengganti.
    }
  }

  const sent = await api.sendMessage(chatId, text, {
    ...options,
    link_preview_options: { is_disabled: true },
  });
  return { messageId: sent.message_id, edited: false };
}
