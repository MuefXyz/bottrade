import type { DetectedBuy } from './detect.js';

export interface CopyBuyNotice {
  kind: 'buy';
  mint: string;
  symbol: string | null;
  sourceWallet: string;
  amountSol: number;
  priceUsd: number | null;
  signature: string | null;
  dryRun: boolean;
}

export interface CopySellNotice {
  kind: 'sell';
  mint: string;
  symbol: string | null;
  reason: 'tp' | 'sl' | 'age' | 'manual';
  pnlPct: number | null;
  closePriceUsd: number | null;
  signature: string | null;
  dryRun: boolean;
}

export interface CopyErrorNotice {
  kind: 'error';
  mint: string | null;
  message: string;
}

export type CopyNotice = CopyBuyNotice | CopySellNotice | CopyErrorNotice;

/** Data posisi terbuka yang sudah dilengkapi harga terkini untuk board live. */
export interface CopyPositionView {
  id: number;
  mint: string;
  symbol: string | null;
  amountSol: number;
  entryPriceUsd: number | null;
  currentPriceUsd: number | null;
  pnlPct: number | null;
  dryRun: boolean;
}

export type BuyHandler = (
  owner: string,
  sourceWallet: string,
  buy: DetectedBuy,
  signature: string,
) => Promise<void>;
