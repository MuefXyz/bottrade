import type { Api } from 'grammy';
import { parseMode } from '../config.js';
import type { Lang } from '../i18n.js';
import { scannerAlertInlineKeyboard } from '../keyboards/mainMenu.js';
import { editOrSendMessage } from '../utils/messageEditor.js';
import { formatAlert } from './format.js';
import type { AlertPayload } from './types.js';

type LangResolver = (chatId: number) => Promise<Lang>;

/**
 * Mengelola satu pesan notifikasi per chat:
 * - Alert pertama meng-edit pesan panel (bila ada), bukan mengirim pesan baru.
 * - Alert berikutnya meng-edit pesan yang sama, jadi chat tidak dibanjiri pesan.
 * - Tombol Stop memakai `deleteMessage` untuk menghapus pesan notifikasi.
 */
export class ScannerNotifier {
  private api: Api | null = null;
  private resolveLang: LangResolver | null = null;
  private readonly messages = new Map<number, number>();

  init(api: Api, resolveLang: LangResolver): void {
    this.api = api;
    this.resolveLang = resolveLang;
  }

  /** Daftarkan pesan panel sebagai target edit alert. */
  registerMessage(chatId: number, messageId: number): void {
    this.messages.set(chatId, messageId);
  }

  async deliver(chatIds: number[], alert: AlertPayload): Promise<void> {
    const api = this.requireApi();
    let delivered = 0;
    const failures: string[] = [];

    // Kirim per chat agar satu user bermasalah tidak memblokir user lain.
    for (const chatId of chatIds) {
      try {
        await this.deliverTo(api, chatId, alert);
        delivered += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`chat ${chatId}: ${message}`);
        console.error(`❌ [notifier] gagal mengirim ke chat ${chatId}:`, message);
      }
    }

    if (delivered === 0) {
      throw new Error(failures.join('; ') || 'Gagal mengirim alert.');
    }
  }

  private async deliverTo(api: Api, chatId: number, alert: AlertPayload): Promise<void> {
    const lang = await this.requireLangResolver()(chatId);
    const text = formatAlert(alert.token, alert.devBuySol, alert.marketCapUsd, lang);
    const options = {
      parse_mode: parseMode(),
      reply_markup: scannerAlertInlineKeyboard(lang, alert.token.mint),
    };

    const result = await editOrSendMessage(
      api,
      chatId,
      this.messages.get(chatId),
      text,
      options,
    );

    this.messages.set(chatId, result.messageId);
    console.log(
      `${result.edited ? '✏️' : '📨'} [notifier] pesan ${result.messageId} di chat ${chatId}`,
    );
  }

  /** Hapus pesan notifikasi (dipakai tombol Stop). */
  async deleteMessage(chatId: number): Promise<void> {
    const messageId = this.messages.get(chatId);
    if (messageId === undefined) return;

    this.messages.delete(chatId);

    try {
      await this.requireApi().deleteMessage(chatId, messageId);
      console.log(`🗑️ [notifier] pesan notifikasi ${messageId} di chat ${chatId} dihapus`);
    } catch {
      // Pesan sudah tidak ada — abaikan.
    }
  }

  private requireApi(): Api {
    if (this.api === null) throw new Error('ScannerNotifier belum diinisialisasi.');
    return this.api;
  }

  private requireLangResolver(): LangResolver {
    if (this.resolveLang === null) throw new Error('ScannerNotifier belum diinisialisasi.');
    return this.resolveLang;
  }
}

export const scannerNotifier = new ScannerNotifier();
