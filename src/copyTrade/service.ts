import { Connection, Keypair } from '@solana/web3.js';
import { t } from '../i18n.js';
import {
  closePosition as closePositionRecord,
  countOpenPositions,
  createOpenPosition,
  findOpenPosition,
  hasOpenPosition,
  listAllOpenPositions,
  listOpenPositions,
  setPositionEntryPrice,
} from '../services/copyPositionService.js';
import { getUserLanguage, getUserWallet } from '../services/userService.js';
import { getCopyTradeSettings, type CopyTradeSettings } from '../services/copyTradeSettingsService.js';
import { listAllWatchedWallets } from '../services/walletWatchService.js';
import { base58Decode, privateKeyFromEncrypted } from '../services/walletService.js';
import { buildCopyTradeConfig, type CopyTradeConfig } from './config.js';
import type { DetectedBuy } from './detect.js';
import { copyTradeNotifier } from './notifier.js';
import { TokenPriceCache, type TokenPrice } from './price.js';
import { executeBuy, executeSell } from './pumpPortalLocal.js';
import { exitReasonForPnl } from './settings.js';
import type { CopyPositionView } from './types.js';
import { WalletWatcher } from './watcher.js';

/** Jangan copy pembelian yang sama berulang dalam jendela ini. */
const BUY_DEDUPE_MS = 30_000;

export interface CopyTradeStatus {
  enabled: boolean;
  dryRun: boolean;
  subscribed: boolean;
  running: boolean;
  subscribers: number;
  lastError: string | null;
}

/** Hasil tombol close manual per posisi. */
export type ManualCloseResult = 'closed' | 'not_found' | 'busy' | 'failed';

export type ManualBuyFailureReason =
  | 'disabled'
  | 'exists'
  | 'max'
  | 'no_wallet'
  | 'failed';

export type ManualBuyResult =
  | {
      ok: true;
      mint: string;
      symbol: string | null;
      amountSol: number;
      priceUsd: number | null;
      signature: string | null;
      dryRun: boolean;
    }
  | { ok: false; reason: ManualBuyFailureReason; message?: string };

type OpenPositionRow = Awaited<ReturnType<typeof listAllOpenPositions>>[number];

export class CopyTradeService {
  private readonly config: CopyTradeConfig;
  private readonly connection: Connection;
  private readonly prices = new TokenPriceCache();
  /** Harga terakhir yang diketahui, dipakai untuk render board live. */
  private readonly lastPrices = new Map<string, TokenPrice>();
  /** Cegah double-sell bila tombol close ditekan berkali-kali / balapan monitor. */
  private readonly closingPositions = new Set<number>();
  private readonly subscribers = new Set<number>();
  private readonly subscriberControllers = new Map<number, AbortController>();
  private readonly recentBuys = new Map<string, number>();

  private watcher: WalletWatcher | null = null;
  private monitorTimer: NodeJS.Timeout | null = null;
  private monitorBusy = false;
  private lastError: string | null = null;

  constructor(
    config: CopyTradeConfig = buildCopyTradeConfig(),
    private readonly now: () => number = Date.now,
  ) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
  }

  getConfig(): CopyTradeConfig {
    return this.config;
  }

  getStatus(chatId?: number): CopyTradeStatus {
    return {
      enabled: this.config.enabled,
      dryRun: this.config.dryRun,
      subscribed: chatId !== undefined && this.subscribers.has(chatId),
      running: this.watcher !== null,
      subscribers: this.subscribers.size,
      lastError: this.lastError,
    };
  }

  start(chatId: number): { ok: boolean; reason?: string } {
    if (!this.config.enabled) return { ok: false, reason: 'disabled' };

    if (!this.subscribers.has(chatId)) {
      this.subscribers.add(chatId);
      this.subscriberControllers.set(chatId, new AbortController());
    }
    if (this.watcher !== null) return { ok: true };

    this.lastError = null;
    this.watcher = new WalletWatcher(
      this.connection,
      () => this.activeTargets(),
      (owner, sourceWallet, buy, signature) =>
        this.handleBuy(owner, sourceWallet, buy, signature),
      this.config.pollMs,
    );

    void this.watcher.start().catch((error: unknown) => {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error('❌ [copy] watcher gagal start:', this.lastError);
    });

    this.monitorTimer = setInterval(() => {
      void this.monitor();
    }, this.config.monitorMs);

    // Tampilkan board langsung bila sudah ada posisi terbuka.
    void this.refreshBoard(chatId).catch((error: unknown) => {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error('❌ [copy] gagal kirim board awal:', this.lastError);
    });

    console.log(
      `🧲 [copy] mulai | ${this.config.dryRun ? 'SIMULASI' : 'LIVE'} | ` +
        `beli default ${this.config.amountSol} SOL (per user) | TP +${this.config.tpPct}% | ` +
        `SL ${this.config.slPct > 0 ? `-${this.config.slPct}%` : 'off'} | ` +
        `poll ${this.config.pollMs}ms | rpc ${this.config.provider}`,
    );

    return { ok: true };
  }

  stop(chatId: number): void {
    this.subscriberControllers.get(chatId)?.abort();
    this.subscriberControllers.delete(chatId);
    this.subscribers.delete(chatId);

    if (this.subscribers.size > 0) return;

    this.watcher?.stop();
    this.watcher = null;

    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    console.log('⏹ [copy] berhenti');
  }

  stopAll(): void {
    for (const controller of this.subscriberControllers.values()) {
      controller.abort();
    }
    this.subscriberControllers.clear();
    this.subscribers.clear();
    this.stop(-1);
  }

  /**
   * Tutup posisi atas permintaan user lewat tombol di board.
   * Validasi kepemilikan + status open dilakukan di sini.
   */
  async closeManually(
    chatId: number,
    positionId: number,
  ): Promise<ManualCloseResult> {
    if (!Number.isInteger(positionId) || positionId <= 0) return 'not_found';

    const position = await findOpenPosition(positionId, String(chatId));
    if (position === null) return 'not_found';
    if (this.closingPositions.has(position.id)) return 'busy';

    const price = await this.prices.get(position.mint);
    if (price !== null) this.lastPrices.set(position.mint, price);

    const closed = await this.closePosition(position, 'manual', price);
    return closed ? 'closed' : 'failed';
  }

  /**
   * Buy manual dari tombol di alert Scanner Token.
   * Tidak mengubah setting user; nominal hanya berlaku untuk pembelian ini.
   */
  async buyManually(
    chatId: number,
    mint: string,
    amountSol: number,
  ): Promise<ManualBuyResult> {
    if (!this.config.enabled) return { ok: false, reason: 'disabled' };
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      return { ok: false, reason: 'failed', message: 'Nominal tidak valid.' };
    }

    const owner = String(chatId);
    if (await hasOpenPosition(owner, mint)) {
      return { ok: false, reason: 'exists' };
    }

    const settings = await getCopyTradeSettings(owner, this.config);
    if ((await countOpenPositions(owner)) >= settings.maxPositions) {
      return { ok: false, reason: 'max' };
    }

    const price = await this.prices.get(mint);
    if (price !== null) this.lastPrices.set(mint, price);

    try {
      let signature: string | null = null;

      if (!this.config.dryRun) {
        const keypair = await this.loadKeypair(owner);
        if (keypair === null) return { ok: false, reason: 'no_wallet' };

        signature = await executeBuy(
          this.connection,
          keypair,
          {
            ...this.config,
            amountSol,
            slippage: settings.slippagePct,
            priorityFee: settings.priorityFeeSol,
          },
          mint,
        );
      }

      const symbol = price?.symbol ?? null;

      await createOpenPosition({
        telegramId: owner,
        mint,
        symbol,
        sourceWallet: 'scanner',
        amountSol,
        entryPriceUsd: price?.priceUsd ?? null,
        takeProfitPct: settings.takeProfitPct,
        stopLossPct: settings.stopLossPct,
        txSignature: signature,
        dryRun: this.config.dryRun,
      });

      await this.refreshBoard(chatId, {
        kind: 'buy',
        mint,
        symbol,
        sourceWallet: 'scanner',
        amountSol,
        priceUsd: price?.priceUsd ?? null,
        signature,
        dryRun: this.config.dryRun,
      });

      console.log(
        `🛒 [scanner] buy manual ${symbol ?? mint} untuk ${owner} ` +
          `(${amountSol} SOL, ${this.config.dryRun ? 'SIMULASI' : 'LIVE'})`,
      );

      return {
        ok: true,
        mint,
        symbol,
        amountSol,
        priceUsd: price?.priceUsd ?? null,
        signature,
        dryRun: this.config.dryRun,
      };
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** Hanya wallet milik user yang sedang running (privasi + hemat RPC). */
  private async activeTargets() {
    const wallets = await listAllWatchedWallets();
    return wallets.filter((wallet) =>
      this.subscribers.has(Number(wallet.telegramId)),
    );
  }

  private async handleBuy(
    owner: string,
    sourceWallet: string,
    buy: DetectedBuy,
    signature: string,
  ): Promise<void> {
    const chatId = Number(owner);
    const controller = this.subscriberControllers.get(chatId);
    if (controller === undefined || controller.signal.aborted) return;

    const dedupeKey = `${owner}:${buy.mint}`;
    const last = this.recentBuys.get(dedupeKey);
    if (last !== undefined && this.now() - last < BUY_DEDUPE_MS) return;

    const lang = await getUserLanguage(owner);
    if (!this.isCurrentSubscriber(chatId, controller)) return;

    if (await hasOpenPosition(owner, buy.mint)) return;
    if (!this.isCurrentSubscriber(chatId, controller)) return;

    const settings = await getCopyTradeSettings(owner, this.config);
    if (!this.isCurrentSubscriber(chatId, controller)) return;

    const openCount = await countOpenPositions(owner);
    if (!this.isCurrentSubscriber(chatId, controller)) return;
    if (openCount >= settings.maxPositions) {
      await this.notifyError(chatId, buy.mint, t(lang, 'copyErrorMaxPositions'));
      return;
    }

    if (settings.amountSol <= 0) {
      await this.notifyError(chatId, buy.mint, t(lang, 'copyErrorAmountUnset'));
      return;
    }

    const price = await this.prices.get(buy.mint);
    if (!this.isCurrentSubscriber(chatId, controller)) return;

    let txSignature: string | null = null;
    try {
      if (!this.config.dryRun) {
        const keypair = await this.loadKeypair(owner);
        if (!this.isCurrentSubscriber(chatId, controller)) return;
        if (keypair === null) {
          await this.notifyError(chatId, buy.mint, t(lang, 'copyErrorNoBotWallet'));
          return;
        }

        txSignature = await executeBuy(
          this.connection,
          keypair,
          {
            ...this.config,
            amountSol: settings.amountSol,
            slippage: settings.slippagePct,
            priorityFee: settings.priorityFeeSol,
          },
          buy.mint,
          controller.signal,
        );
        this.recentBuys.set(dedupeKey, this.now());
      } else if (!this.isCurrentSubscriber(chatId, controller)) {
        return;
      }

      await createOpenPosition({
        telegramId: owner,
        mint: buy.mint,
        symbol: price?.symbol ?? null,
        sourceWallet,
        amountSol: settings.amountSol,
        entryPriceUsd: price?.priceUsd ?? null,
        takeProfitPct: settings.takeProfitPct,
        stopLossPct: settings.stopLossPct,
        txSignature,
        dryRun: this.config.dryRun,
      });

      if (price !== null) this.lastPrices.set(buy.mint, price);

      this.recentBuys.set(dedupeKey, this.now());
      await this.refreshBoard(chatId, {
        kind: 'buy',
        mint: buy.mint,
        symbol: price?.symbol ?? null,
        sourceWallet,
        amountSol: settings.amountSol,
        priceUsd: price?.priceUsd ?? null,
        signature: txSignature,
        dryRun: this.config.dryRun,
      });

      console.log(
        `🎯 [copy] buy ${price?.symbol ?? buy.mint} untuk ${owner} ` +
          `(${settings.amountSol} SOL, source ${sourceWallet})`,
      );
    } catch (error) {
      if (txSignature === null && !this.isCurrentSubscriber(chatId, controller)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.notifyError(
        chatId,
        buy.mint,
        `${t(lang, 'copyErrorBuyFailed')}: ${message}`,
      );
      if (txSignature === null && this.isCurrentSubscriber(chatId, controller)) {
        throw error;
      }
    }
  }

  private isCurrentSubscriber(
    chatId: number,
    controller: AbortController,
  ): boolean {
    return (
      this.subscribers.has(chatId) &&
      this.subscriberControllers.get(chatId) === controller &&
      !controller.signal.aborted
    );
  }

  private async monitor(): Promise<void> {
    if (this.monitorBusy || this.subscribers.size === 0) return;
    this.monitorBusy = true;

    try {
      const positions = await listAllOpenPositions();
      const viewsByOwner = new Map<string, CopyPositionView[]>();
      const closedOwners = new Set<string>();
      const settingsByOwner = new Map<string, CopyTradeSettings>();

      const settingsFor = async (owner: string): Promise<CopyTradeSettings> => {
        const cached = settingsByOwner.get(owner);
        if (cached !== undefined) return cached;

        const loaded = await getCopyTradeSettings(owner, this.config);
        settingsByOwner.set(owner, loaded);
        return loaded;
      };

      for (const position of positions) {
        if (!this.subscribers.has(Number(position.telegramId))) continue;
        if (this.closingPositions.has(position.id)) continue;

        const settings = await settingsFor(position.telegramId);

        const ageMs = this.now() - position.openedAt.getTime();
        if (
          settings.maxAgeMinutes > 0 &&
          ageMs >= settings.maxAgeMinutes * 60_000
        ) {
          const closed = await this.closePosition(position, 'age', null);
          if (closed) closedOwners.add(position.telegramId);
          continue;
        }

        const price = await this.prices.get(position.mint);
        if (price !== null) this.lastPrices.set(position.mint, price);

        let entryPriceUsd = position.entryPriceUsd;
        if (entryPriceUsd === null || entryPriceUsd <= 0) {
          if (price === null) {
            this.pushView(viewsByOwner, position, null);
            continue;
          }
          await setPositionEntryPrice(position.id, price.priceUsd);
          entryPriceUsd = price.priceUsd;
        } else if (price !== null) {
          const pnlPct =
            ((price.priceUsd - entryPriceUsd) / entryPriceUsd) * 100;
          const takeProfitPct = position.takeProfitPct ?? settings.takeProfitPct;
          const stopLossPct = position.stopLossPct ?? settings.stopLossPct;

          const reason = exitReasonForPnl(pnlPct, takeProfitPct, stopLossPct);
          if (reason !== null) {
            const closed = await this.closePosition(position, reason, price);
            if (closed) closedOwners.add(position.telegramId);
            continue;
          }
        }

        this.pushView(viewsByOwner, position, price, entryPriceUsd);
      }

      for (const [owner, views] of viewsByOwner) {
        if (closedOwners.has(owner)) continue;
        await copyTradeNotifier.updateBoard(Number(owner), views);
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error('❌ [copy] monitor error:', this.lastError);
    } finally {
      this.monitorBusy = false;
    }
  }

  private pushView(
    viewsByOwner: Map<string, CopyPositionView[]>,
    position: OpenPositionRow,
    price: TokenPrice | null,
    entryPriceUsd: number | null = position.entryPriceUsd,
  ): void {
    const view = this.toPositionView(position, price, entryPriceUsd);
    const views = viewsByOwner.get(position.telegramId) ?? [];
    views.push(view);
    viewsByOwner.set(position.telegramId, views);
  }

  private toPositionView(
    position: OpenPositionRow,
    price: TokenPrice | null,
    entryPriceUsd: number | null = position.entryPriceUsd,
  ): CopyPositionView {
    const currentPriceUsd = price?.priceUsd ?? null;
    const pnlPct =
      entryPriceUsd !== null && entryPriceUsd > 0 && currentPriceUsd !== null
        ? ((currentPriceUsd - entryPriceUsd) / entryPriceUsd) * 100
        : null;

    return {
      id: position.id,
      mint: position.mint,
      symbol: position.symbol ?? price?.symbol ?? null,
      amountSol: position.amountSol,
      entryPriceUsd,
      currentPriceUsd,
      pnlPct,
      dryRun: position.dryRun,
    };
  }

  /** Data posisi terbuka user + harga terkini, untuk panel Posisi Terbuka. */
  async getOpenPositionViews(telegramId: string): Promise<CopyPositionView[]> {
    const positions = await listOpenPositions(telegramId);
    const views: CopyPositionView[] = [];

    for (const position of positions) {
      let price = this.lastPrices.get(position.mint) ?? null;
      if (price === null) {
        price = await this.prices.get(position.mint);
        if (price !== null) this.lastPrices.set(position.mint, price);
      }
      views.push(this.toPositionView(position, price));
    }

    return views;
  }

  /** Render ulang board dari DB, memakai harga terakhir / mengambil yang baru. */
  private async refreshBoard(
    chatId: number,
    notice?: Parameters<typeof copyTradeNotifier.updateBoard>[2],
  ): Promise<void> {
    // Saat scan berhenti, board memang sudah dihapus; jangan buat board baru
    // hanya karena posisi ditutup dari panel Posisi Terbuka.
    if (!this.subscribers.has(chatId)) return;

    const views = await this.getOpenPositionViews(String(chatId));
    await copyTradeNotifier.updateBoard(chatId, views, notice);
  }

  private async closePosition(
    position: OpenPositionRow,
    reason: 'tp' | 'sl' | 'age' | 'manual',
    price: TokenPrice | null,
  ): Promise<boolean> {
    if (this.closingPositions.has(position.id)) return false;
    this.closingPositions.add(position.id);

    const chatId = Number(position.telegramId);
    const lang = await getUserLanguage(position.telegramId);

    try {
      let signature: string | null = null;

      if (!position.dryRun) {
        const keypair = await this.loadKeypair(position.telegramId);
        if (keypair === null) {
          await this.notifyError(chatId, position.mint, t(lang, 'copyErrorNoBotWallet'));
          return false;
        }

        const settings = await getCopyTradeSettings(
          position.telegramId,
          this.config,
        );

        signature = await executeSell(
          this.connection,
          keypair,
          {
            ...this.config,
            slippage: settings.slippagePct,
            priorityFee: settings.priorityFeeSol,
          },
          position.mint,
        );
      }

      const pnlPct =
        position.entryPriceUsd !== null &&
        position.entryPriceUsd > 0 &&
        price !== null
          ? ((price.priceUsd - position.entryPriceUsd) / position.entryPriceUsd) * 100
          : null;

      await closePositionRecord(position.id, {
        reason,
        closePriceUsd: price?.priceUsd ?? null,
        pnlPct,
        closeSignature: signature,
      });

      await this.refreshBoard(chatId, {
        kind: 'sell',
        mint: position.mint,
        symbol: position.symbol ?? price?.symbol ?? null,
        reason,
        pnlPct,
        closePriceUsd: price?.priceUsd ?? null,
        signature,
        dryRun: position.dryRun,
      });

      console.log(
        `💰 [copy] sell ${position.mint} (${reason}) untuk ${position.telegramId} ` +
          `PnL ${pnlPct === null ? '?' : pnlPct.toFixed(2) + '%'}`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.notifyError(
        chatId,
        position.mint,
        `${t(lang, 'copyErrorSellFailed')}: ${message}`,
      );
      return false;
    } finally {
      this.closingPositions.delete(position.id);
    }
  }

  private async loadKeypair(telegramId: string): Promise<Keypair | null> {
    const wallet = await getUserWallet(telegramId);
    if (!wallet?.encryptedPrivateKey) return null;

    try {
      const secretKey = base58Decode(
        privateKeyFromEncrypted(wallet.encryptedPrivateKey),
      );
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      return null;
    }
  }

  private async notifyError(
    chatId: number,
    mint: string | null,
    message: string,
  ): Promise<void> {
    try {
      await this.refreshBoard(chatId, { kind: 'error', mint, message });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error('❌ [copy] gagal kirim notifikasi error:', this.lastError);
    }
  }
}
