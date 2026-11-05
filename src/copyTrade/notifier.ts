import type { Api } from 'grammy';
import { parseMode } from '../config.js';
import type { Lang } from '../i18n.js';
import { copyTradeBoardKeyboard } from '../keyboards/mainMenu.js';
import { editOrSendMessage } from '../utils/messageEditor.js';
import { formatPositionBoard } from './format.js';
import type { CopyNotice, CopyPositionView } from './types.js';

type LangResolver = (chatId: number) => Promise<Lang>;

/**
 * Satu board live per chat. Buy/sell/error berikutnya dan update PnL berkala
 * meng-edit pesan yang sama, jadi chat tidak dibanjiri pesan tiap trade.
 */
export class CopyTradeNotifier {
  private api: Api | null = null;
  private resolveLang: LangResolver | null = null;
  private readonly messages = new Map<number, number>();

  init(api: Api, resolveLang: LangResolver): void {
    this.api = api;
    this.resolveLang = resolveLang;
  }

  registerMessage(chatId: number, messageId: number): void {
    this.messages.set(chatId, messageId);
  }

  /**
   * Perbarui board posisi + PnL terkini. Bila tidak ada posisi dan tidak ada
   * event, pesan tidak dikirim (menghindari board kosong saat Start Scan).
   */
  async updateBoard(
    chatId: number,
    positions: CopyPositionView[],
    notice?: CopyNotice,
  ): Promise<void> {
    if (positions.length === 0 && notice === undefined) return;

    const api = this.requireApi();
    const lang = await this.requireLangResolver()(chatId);
    const text = formatPositionBoard(positions, lang, { notice });
    const options =
      positions.length > 0
        ? {
            parse_mode: parseMode(),
            reply_markup: copyTradeBoardKeyboard(lang, positions),
          }
        : { parse_mode: parseMode() };

    const result = await editOrSendMessage(
      api,
      chatId,
      this.messages.get(chatId),
      text,
      options,
    );

    this.messages.set(chatId, result.messageId);
    console.log(
      `${result.edited ? '✏️' : '📨'} [copy] board ${positions.length} posisi` +
        `${notice ? ` + event ${notice.kind}` : ''} → chat ${chatId}`,
    );
  }

  async deleteMessage(chatId: number): Promise<void> {
    const messageId = this.messages.get(chatId);
    if (messageId === undefined) return;

    this.messages.delete(chatId);

    try {
      await this.requireApi().deleteMessage(chatId, messageId);
    } catch {
      // Pesan sudah tidak ada — abaikan.
    }
  }

  private requireApi(): Api {
    if (this.api === null) throw new Error('CopyTradeNotifier belum diinisialisasi.');
    return this.api;
  }

  private requireLangResolver(): LangResolver {
    if (this.resolveLang === null) {
      throw new Error('CopyTradeNotifier belum diinisialisasi.');
    }
    return this.resolveLang;
  }
}

export const copyTradeNotifier = new CopyTradeNotifier();
