import { env, type Env } from '../config.js';

/**
 * Nilai default untuk pengaturan per user. Diambil dari kode, bukan `.env`,
 * karena setiap user bisa mengubahnya lewat menu ⚙️ Pengaturan.
 */
export const COPY_TRADE_DEFAULTS = {
  amountSol: 0.01,
  /** Take profit dalam persen, mis. 150 = +150%. 0 = nonaktif. */
  tpPct: 150,
  /** Stop loss dalam persen (selalu positif), mis. 50 = -50%. 0 = nonaktif. */
  slPct: 0,
  /** Auto-close posisi setelah X menit. 0 = nonaktif. */
  maxAgeMinutes: 0,
  /** Slippage dalam persen. */
  slippagePct: 15,
  /** Priority fee dalam SOL. */
  priorityFeeSol: 0.0001,
  /** Maksimal posisi open per user. */
  maxPositions: 5,
} as const;

export interface CopyTradeConfig {
  enabled: boolean;
  dryRun: boolean;
  amountSol: number;
  /** Take profit dalam persen, mis. 150 = +150%. 0 = nonaktif. */
  tpPct: number;
  /** Stop loss dalam persen (selalu positif), mis. 50 = -50%. 0 = nonaktif. */
  slPct: number;
  maxAgeMs: number;
  slippage: number;
  priorityFee: number;
  pool: string;
  /** Interval polling signature wallet (ms). */
  pollMs: number;
  /** Interval cek harga untuk TP/SL (ms). */
  monitorMs: number;
  maxPositions: number;
  provider: string;
  rpcUrl: string;
  heliusApiKey: string | null;
}

/** Bagian config yang dipakai sebagai fallback pengaturan per user. */
export type CopyTradeDefaults = Pick<
  CopyTradeConfig,
  | 'amountSol'
  | 'tpPct'
  | 'slPct'
  | 'maxAgeMs'
  | 'maxPositions'
  | 'slippage'
  | 'priorityFee'
>;

export interface RpcSource {
  heliusApiKey?: string;
  heliusRpcUrl?: string;
  solanaRpcUrl: string;
}

export function resolveRpcUrl(source: RpcSource): string {
  const custom = source.heliusRpcUrl?.trim();
  if (custom) return custom;

  const apiKey = source.heliusApiKey?.trim();
  if (apiKey) return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

  return source.solanaRpcUrl;
}

export function resolvePollMs(
  provider: string,
  configuredMs: number,
  hasHelius: boolean,
): number {
  // Helius jauh lebih longgar rate limit-nya; RPC publik perlu jeda lebih aman.
  if (hasHelius) return Math.max(1_000, configuredMs);
  if (provider === 'rpc') return Math.max(2_000, configuredMs);
  return Math.max(2_000, configuredMs);
}

export function buildCopyTradeConfig(source: Env = env): CopyTradeConfig {
  const heliusApiKey = source.HELIUS_API_KEY?.trim() || null;
  const rpcUrl = resolveRpcUrl({
    heliusApiKey: heliusApiKey ?? undefined,
    heliusRpcUrl: source.HELIUS_RPC_URL,
    solanaRpcUrl: source.SOLANA_RPC_URL,
  });

  return {
    enabled: source.COPY_TRADE_ENABLED === 'true',
    dryRun: source.COPY_TRADE_DRY_RUN === 'true',
    amountSol: COPY_TRADE_DEFAULTS.amountSol,
    tpPct: COPY_TRADE_DEFAULTS.tpPct,
    slPct: COPY_TRADE_DEFAULTS.slPct,
    maxAgeMs: COPY_TRADE_DEFAULTS.maxAgeMinutes * 60_000,
    slippage: COPY_TRADE_DEFAULTS.slippagePct,
    priorityFee: COPY_TRADE_DEFAULTS.priorityFeeSol,
    pool: source.COPY_TRADE_POOL,
    pollMs: resolvePollMs(
      source.COPY_TRADE_PROVIDER,
      source.COPY_TRADE_RPC_POLL_MS,
      heliusApiKey !== null,
    ),
    monitorMs: source.COPY_TRADE_POLL_SECONDS * 1_000,
    maxPositions: COPY_TRADE_DEFAULTS.maxPositions,
    provider: heliusApiKey !== null ? 'helius' : source.COPY_TRADE_PROVIDER,
    rpcUrl,
    heliusApiKey,
  };
}
