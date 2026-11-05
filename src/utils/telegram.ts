import { GrammyError, type Context } from 'grammy';

export function isMessageNotModified(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.description.includes('message is not modified')
  );
}

/**
 * `answerCallbackQuery` yang tidak melempar untuk callback kedaluwarsa.
 *
 * Telegram menolak callback lama dengan "query is too old ...". Itu bukan
 * kegagalan aksi: handler harus tetap lanjut meng-edit panel.
 */
export async function safeAnswerCallbackQuery(
  ctx: Context,
  other?: Parameters<Context['answerCallbackQuery']>[0],
): Promise<void> {
  try {
    await ctx.answerCallbackQuery(other);
  } catch (error) {
    if (
      error instanceof GrammyError &&
      /query is too old|query ID is invalid/i.test(error.description)
    ) {
      return;
    }
    throw error;
  }
}

/**
 * `editMessageText` yang aman untuk tombol seperti Refresh: bila isi pesan
 * sama persis, Telegram menolak dengan "message is not modified". Itu bukan
 * kegagalan nyata, jadi diabaikan saja.
 */
export async function safeEditMessageText(
  ctx: Context,
  text: string,
  other?: Parameters<Context['editMessageText']>[1],
): Promise<void> {
  try {
    await ctx.editMessageText(text, other);
  } catch (error) {
    if (isMessageNotModified(error)) return;
    throw error;
  }
}
