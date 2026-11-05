import { PumpPortalClient } from './client.js';
import { buildScannerConfig, type ScannerConfig } from './config.js';
import { devBuyReached, isMarketCapEligible, tradeSolAmount } from './logic.js';
import { SolPriceCache } from './solPrice.js';
import type { AlertPayload, AlertToken, NewTokenEvent, ScannerFilter, TradeEvent } from './types.js';

const TICK_MS = 5_000;
const PRICE_REFRESH_MS = 60_000;
const MAX_WATCHED_TOKENS = 30;
const ALERTED_CACHE_MAX = 5_000;

export type AlertNotifier = (chatIds: number[], alert: AlertPayload) => Promise<void>;

export interface ScannerStatus {
  enabled: boolean;
  running: boolean;
  subscribed: boolean;
  pausedUntil: number | null;
  watching: number;
  alertsSent: number;
  tokensSeen: number;
  subscribers: number;
  lastError: string | null;
}

interface WatchedToken {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  devBuySol: number;
  marketCapSol: number;
  startedAt: number;
}

export class TokenScanner {
  private readonly price = new SolPriceCache();
  private client: PumpPortalClient | null = null;
  private notifier: AlertNotifier | null = null;

  private running = false;
  /** Chat yang menekan Start Scan — tiap chat hanya menerima alert miliknya sendiri. */
  private readonly subscribers = new Set<number>();
  private readonly filters = new Map<number, ScannerFilter>();
  private readonly pausedUntil = new Map<number, number>();
  private readonly alertsSent = new Map<number, number>();
  private watched = new Map<string, WatchedToken>();
  /** Key `${chatId}:${mint}` — tiap chat punya riwayat alert sendiri. */
  private readonly alerted = new Set<string>();
  private alertedOrder: string[] = [];
  private tokensSeen = 0;
  private lastError: string | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private priceTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ScannerConfig = buildScannerConfig(),
    private readonly now: () => number = Date.now,
  ) {}

  setNotifier(notifier: AlertNotifier): void {
    this.notifier = notifier;
  }

  getConfig(): ScannerConfig {
    return this.config;
  }

  /** Filter yang berlaku untuk chat; fallback ke default config bila belum diatur. */
  getFilter(chatId: number): ScannerFilter {
    return (
      this.filters.get(chatId) ?? {
        minMarketCapUsd: this.config.minMarketCapUsd,
        minDevBuySol: this.config.devBuyMinSol,
        windowMs: this.config.devBuyWindowMs,
        pauseMs: this.config.pauseMs,
      }
    );
  }

  /** Simpan filter per chat (dipanggil saat Start Scan / pengaturan diubah). */
  setFilter(chatId: number, filter: ScannerFilter): void {
    this.filters.set(chatId, filter);
  }

  getStatus(chatId?: number): ScannerStatus {
    const pausedUntil = chatId === undefined ? null : this.pausedUntil.get(chatId) ?? null;

    return {
      enabled: this.config.enabled,
      running: this.running,
      subscribed: chatId !== undefined && this.subscribers.has(chatId),
      pausedUntil:
        pausedUntil !== null && this.now() < pausedUntil ? pausedUntil : null,
      watching: this.watched.size,
      alertsSent: chatId === undefined ? 0 : this.alertsSent.get(chatId) ?? 0,
      tokensSeen: this.tokensSeen,
      subscribers: this.subscribers.size,
      lastError: this.lastError,
    };
  }

  start(chatId?: number): { ok: boolean; reason?: string } {
    if (!this.config.enabled) return { ok: false, reason: 'disabled' };

    if (chatId !== undefined) {
      this.subscribers.add(chatId);
      this.pausedUntil.delete(chatId);
    }

    if (this.running) return { ok: true };

    this.running = true;
    this.lastError = null;

    this.client = new PumpPortalClient(this.config.apiKey, {
      onNewToken: (event) => this.onNewToken(event),
      onTrade: (event) => this.onTrade(event),
      onOpen: () => {
        this.lastError = null;
        console.log('🔌 [scanner] PumpPortal terhubung (subscribeNewToken)');
      },
      onError: (error) => {
        this.lastError = error.message;
        console.error('❌ [scanner] WebSocket error:', error.message);
      },
    });
    this.client.start();

    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    this.priceTimer = setInterval(() => {
      void this.refreshPrice();
    }, PRICE_REFRESH_MS);
    void this.refreshPrice();

    console.log(
      `🔎 [scanner] mulai | devBuy≥${this.config.devBuyMinSol} SOL | ` +
        `mcap≥$${this.config.minMarketCapUsd} | jeda ${Math.round(this.config.pauseMs / 60_000)}m | ` +
        `apiKey=${this.config.apiKey ? 'ada' : 'tidak (mode gratis)'}`,
    );

    return { ok: true };
  }

  stop(chatId?: number): void {
    if (chatId !== undefined) {
      this.subscribers.delete(chatId);
      this.pausedUntil.delete(chatId);
      this.filters.delete(chatId);

      // Masih ada user lain yang berlangganan → koneksi tetap jalan.
      if (this.subscribers.size > 0) return;
    }

    this.running = false;
    this.subscribers.clear();
    this.filters.clear();
    this.pausedUntil.clear();
    this.alerted.clear();
    this.alertedOrder = [];

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    if (this.priceTimer) {
      clearInterval(this.priceTimer);
      this.priceTimer = null;
    }

    this.client?.stop();
    this.client = null;
    this.watched.clear();

    console.log(
      `⏹ [scanner] berhenti | token terlihat: ${this.tokensSeen}`,
    );
  }

  private onNewToken(event: NewTokenEvent): void {
    if (!this.running) return;

    this.tokensSeen += 1;

    const marketCapSol = event.marketCapSol ?? 0;
    const initialBuySol = tradeSolAmount(event);
    const label = `${event.symbol ?? '?'} (mcap ${marketCapSol.toFixed(1)} SOL, devBuy ${initialBuySol.toFixed(3)} SOL)`;

    const targets = this.activeTargets();
    if (targets.length === 0) {
      console.log(`📥 [scanner] #${this.tokensSeen} ${label} → tidak ada chat aktif (belum Start / sedang jeda)`);
      return;
    }

    // Sudah menunggu akumulasi dev buy.
    if (this.watched.has(event.mint)) return;

    const solPrice = this.price.get();
    const eligible = targets.filter(
      (chatId) =>
        !this.isAlerted(chatId, event.mint) &&
        isMarketCapEligible(
          marketCapSol,
          solPrice,
          this.getFilter(chatId).minMarketCapUsd,
        ),
    );

    if (eligible.length === 0) {
      console.log(`📥 [scanner] #${this.tokensSeen} ${label} → mcap di bawah filter`);
      return;
    }

    const immediate = eligible.filter((chatId) =>
      devBuyReached(initialBuySol, this.getFilter(chatId).minDevBuySol),
    );

    if (immediate.length > 0) {
      console.log(`📥 [scanner] #${this.tokensSeen} ${label} → lolos filter, kirim alert`);
      void this.sendAlert(event, initialBuySol, marketCapSol, immediate);
    }

    // Chat yang ambang dev buy-nya belum tercapai perlu dipantau akumulasinya.
    if (this.config.apiKey === null) {
      if (immediate.length === 0) {
        console.log(`📥 [scanner] #${this.tokensSeen} ${label} → devBuy < min (mode gratis)`);
      }
      return;
    }

    const watchFor = eligible.filter((chatId) => {
      const filter = this.getFilter(chatId);
      return (
        filter.windowMs > 0 &&
        !devBuyReached(initialBuySol, filter.minDevBuySol)
      );
    });

    if (watchFor.length === 0) return;
    if (this.watched.size >= MAX_WATCHED_TOKENS) return;

    this.watched.set(event.mint, {
      mint: event.mint,
      name: event.name ?? 'Unknown',
      symbol: event.symbol ?? '?',
      creator: event.traderPublicKey,
      devBuySol: initialBuySol,
      marketCapSol,
      startedAt: this.now(),
    });
    this.client?.subscribeTokenTrades([event.mint]);
  }

  private onTrade(event: TradeEvent): void {
    if (!this.running) return;

    const watched = this.watched.get(event.mint);
    if (!watched) return;
    if (event.traderPublicKey !== watched.creator) return;
    if (event.txType !== 'buy') return;

    watched.devBuySol += tradeSolAmount(event);
    watched.marketCapSol = event.marketCapSol ?? watched.marketCapSol;

    const now = this.now();
    const solPrice = this.price.get();
    const targets = this.activeTargets().filter((chatId) => {
      if (this.isAlerted(chatId, watched.mint)) return false;

      const filter = this.getFilter(chatId);
      if (now - watched.startedAt >= filter.windowMs) return false;
      if (
        !isMarketCapEligible(
          watched.marketCapSol,
          solPrice,
          filter.minMarketCapUsd,
        )
      ) {
        return false;
      }

      return devBuyReached(watched.devBuySol, filter.minDevBuySol);
    });

    if (targets.length === 0) return;

    void this.sendAlert(
      {
        mint: watched.mint,
        name: watched.name,
        symbol: watched.symbol,
        traderPublicKey: watched.creator,
        marketCapSol: watched.marketCapSol,
      },
      watched.devBuySol,
      watched.marketCapSol,
      targets,
    );
  }

  private tick(): void {
    if (!this.running) return;

    const now = this.now();

    for (const [chatId, until] of this.pausedUntil) {
      if (now >= until) this.pausedUntil.delete(chatId);
    }

    const expiredMints: string[] = [];
    for (const watched of this.watched.values()) {
      if (!this.shouldKeepWatching(watched, now)) {
        expiredMints.push(watched.mint);
      }
    }

    if (expiredMints.length === 0) return;

    expiredMints.forEach((mint) => this.watched.delete(mint));
    this.client?.unsubscribeTokenTrades(expiredMints);
  }

  /** Masih ada chat yang mungkin butuh token ini dalam window-nya? */
  private shouldKeepWatching(watched: WatchedToken, now: number): boolean {
    const solPrice = this.price.get();

    for (const chatId of this.subscribers) {
      if (this.isAlerted(chatId, watched.mint)) continue;

      const filter = this.getFilter(chatId);
      if (filter.windowMs <= 0) continue;
      if (now - watched.startedAt >= filter.windowMs) continue;
      if (
        !isMarketCapEligible(
          watched.marketCapSol,
          solPrice,
          filter.minMarketCapUsd,
        )
      ) {
        continue;
      }

      return true;
    }

    return false;
  }

  private async sendAlert(
    token: AlertToken,
    devBuySol: number,
    marketCapSol: number,
    chatIds: number[],
  ): Promise<void> {
    const now = this.now();
    const targets = chatIds.filter(
      (chatId) =>
        this.subscribers.has(chatId) &&
        this.isActive(chatId, now) &&
        !this.isAlerted(chatId, token.mint),
    );

    if (targets.length === 0) {
      console.log(
        `⚠️ [scanner] alert ${token.symbol ?? token.mint} batal: tidak ada chat yang masih aktif.`,
      );
      return;
    }

    const solPrice = this.price.get();
    const marketCapUsd = solPrice === null ? null : marketCapSol * solPrice;

    try {
      await this.notifier?.(targets, { token, devBuySol, marketCapUsd });

      for (const chatId of targets) {
        this.markAlerted(chatId, token.mint);
        this.alertsSent.set(chatId, (this.alertsSent.get(chatId) ?? 0) + 1);

        const pauseMs = this.getFilter(chatId).pauseMs;
        if (pauseMs > 0) this.pausedUntil.set(chatId, this.now() + pauseMs);
      }

      console.log(
        `🚨 [scanner] alert terkirim: ${token.symbol ?? token.mint} → chat ${targets.join(', ')} ` +
          `(devBuy ${devBuySol.toFixed(3)} SOL, mcap ${marketCapSol.toFixed(1)} SOL)`,
      );
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Gagal mengirim alert.';
      console.error('❌ [scanner] gagal kirim alert:', this.lastError);
    }
  }

  /** Chat yang berlangganan dan sedang tidak dalam masa jeda. */
  private activeTargets(): number[] {
    const now = this.now();

    return [...this.subscribers].filter((chatId) => this.isActive(chatId, now));
  }

  private isActive(chatId: number, now: number): boolean {
    const until = this.pausedUntil.get(chatId);
    return until === undefined || until <= now;
  }

  private alertKey(chatId: number, mint: string): string {
    return `${chatId}:${mint}`;
  }

  private isAlerted(chatId: number, mint: string): boolean {
    return this.alerted.has(this.alertKey(chatId, mint));
  }

  private markAlerted(chatId: number, mint: string): void {
    const key = this.alertKey(chatId, mint);
    if (this.alerted.has(key)) return;

    this.alerted.add(key);
    this.alertedOrder.push(key);

    if (this.alertedOrder.length > ALERTED_CACHE_MAX) {
      const oldest = this.alertedOrder.shift();
      if (oldest !== undefined) this.alerted.delete(oldest);
    }
  }

  private async refreshPrice(): Promise<void> {
    try {
      await this.price.refresh();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Gagal mengambil harga SOL.';
    }
  }
}
