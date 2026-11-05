import { PublicKey, type Connection } from '@solana/web3.js';
import { boughtMints, type ParsedTransactionLike } from './detect.js';
import type { BuyHandler } from './types.js';

export interface WatchTarget {
  telegramId: string;
  address: string;
}

const SIGNATURE_LIMIT = 1_000;
const MAX_SUPPORTED_TRANSACTION_VERSION = 1;
const MAX_RATE_LIMIT_BACKOFF_MS = 60_000;

/**
 * Polling transaksi wallet yang dipantau via RPC.
 *
 * - Wallet baru di-baseline tanpa memproses transaksi lama.
 * - Signature baru diproses berurutan dan checkpoint hanya maju setelah
 *   transaksi selesai, sehingga kegagalan RPC dapat dicoba ulang.
 */
export class WalletWatcher {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private busy = false;
  private rateLimitFailures = 0;
  private readonly lastSignatures = new Map<string, string | null>();
  private readonly baselined = new Set<string>();
  private readonly baselineSlots = new Map<string, number>();

  constructor(
    private readonly connection: Connection,
    private readonly getTargets: () => Promise<WatchTarget[]>,
    private readonly onBuy: BuyHandler,
    private readonly pollMs: number,
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Poll pertama hanya menyimpan baseline, tidak memproses transaksi lama.
    await this.poll();
  }

  stop(): void {
    this.running = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.lastSignatures.clear();
    this.baselined.clear();
    this.baselineSlots.clear();
    this.rateLimitFailures = 0;
  }

  private async poll(): Promise<void> {
    if (!this.running || this.busy) return;
    this.busy = true;
    let rateLimited = false;

    try {
      const targets = await this.getTargets();
      const grouped = new Map<string, string[]>();

      for (const target of targets) {
        const owners = grouped.get(target.address) ?? [];
        if (!owners.includes(target.telegramId)) owners.push(target.telegramId);
        grouped.set(target.address, owners);
      }

      // Bersihkan wallet yang sudah dihapus user.
      for (const address of [...this.lastSignatures.keys()]) {
        if (!grouped.has(address)) {
          this.lastSignatures.delete(address);
          this.baselined.delete(address);
          this.baselineSlots.delete(address);
        }
      }

      for (const [address, owners] of grouped) {
        if (!this.running) break;

        try {
          await this.pollAddress(address, owners);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`❌ [copy] gagal poll wallet ${address}: ${message}`);
          if (isRateLimitError(error)) {
            rateLimited = true;
            break;
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ [copy] polling watcher gagal: ${message}`);
      rateLimited = isRateLimitError(error);
    } finally {
      this.busy = false;
      if (this.running) {
        this.rateLimitFailures = rateLimited ? this.rateLimitFailures + 1 : 0;
        const delay = rateLimited
          ? Math.min(
              this.pollMs * 2 ** Math.min(this.rateLimitFailures, 5),
              MAX_RATE_LIMIT_BACKOFF_MS,
            )
          : this.pollMs;
        this.timer = setTimeout(() => {
          this.timer = null;
          void this.poll();
        }, delay);
      }
    }
  }

  private async pollAddress(address: string, owners: string[]): Promise<void> {
    const publicKey = new PublicKey(address);

    if (!this.baselined.has(address)) {
      const baselineSlot = await this.connection.getSlot('confirmed');
      const latest = await this.connection.getSignaturesForAddress(
        publicKey,
        { limit: 1 },
        'confirmed',
      );
      const latestInfo = latest[0];
      if (latestInfo === undefined || latestInfo.slot > baselineSlot) {
        this.lastSignatures.set(address, null);
        this.baselineSlots.set(address, baselineSlot);
      } else {
        this.lastSignatures.set(address, latestInfo.signature);
      }
      this.baselined.add(address);
      return;
    }

    const last = this.lastSignatures.get(address) ?? null;
    const fresh = await this.getFreshSignatures(publicKey, address, last);

    // getSignaturesForAddress mengembalikan terbaru dulu; proses dari yang lama.
    for (const info of fresh.reverse()) {
      if (!this.running) return;
      if (info.err !== null) {
        this.lastSignatures.set(address, info.signature);
        continue;
      }

      const transaction = await this.connection.getParsedTransaction(info.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: MAX_SUPPORTED_TRANSACTION_VERSION,
      });
      if (transaction === null) {
        throw new Error(`Transaksi ${info.signature} belum tersedia dari RPC.`);
      }

      const buys = boughtMints(
        transaction as unknown as ParsedTransactionLike,
        address,
      );

      for (const buy of buys) {
        for (const owner of owners) {
          await this.onBuy(owner, address, buy, info.signature);
        }
      }

      this.lastSignatures.set(address, info.signature);
    }
  }

  private async getFreshSignatures(
    publicKey: PublicKey,
    address: string,
    last: string | null,
  ) {
    const fresh = [];
    const baselineSlot = this.baselineSlots.get(address);
    let before: string | undefined;

    while (this.running) {
      const page = await this.connection.getSignaturesForAddress(
        publicKey,
        {
          limit: SIGNATURE_LIMIT,
          ...(before === undefined ? {} : { before }),
          ...(last === null ? {} : { until: last }),
        },
        'confirmed',
      );
      if (page.length === 0) break;

      let reachedBaseline = false;
      for (const info of page) {
        if (info.signature === last) {
          reachedBaseline = true;
          break;
        }
        if (baselineSlot !== undefined && info.slot <= baselineSlot) {
          reachedBaseline = true;
          break;
        }
        fresh.push(info);
      }

      if (reachedBaseline || page.length < SIGNATURE_LIMIT) break;
      before = page[page.length - 1].signature;
    }

    return fresh;
  }
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:\b429\b|too many requests|rate.?limit)/i.test(message);
}
