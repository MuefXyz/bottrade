export interface PumpPortalEvent {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: string;
  name?: string;
  symbol?: string;
  uri?: string;
  marketCapSol?: number;
  vTokensInBondingCurve?: number;
  vSolInBondingCurve?: number;
  solAmount?: number;
  tokenAmount?: number;
}

export type NewTokenEvent = PumpPortalEvent & { txType: 'create' };

export type TradeEvent = PumpPortalEvent & {
  txType: 'buy' | 'sell' | 'complete' | 'create_pool';
};

export type AlertToken = {
  mint: string;
  name?: string;
  symbol?: string;
  traderPublicKey: string;
  marketCapSol?: number;
};

export type AlertPayload = {
  token: AlertToken;
  devBuySol: number;
  marketCapUsd: number | null;
};

/** Ambang filter scanner yang berlaku untuk satu chat. */
export interface ScannerFilter {
  minMarketCapUsd: number;
  minDevBuySol: number;
  /** Window akumulasi dev buy (ms). 0 = hanya alert langsung. */
  windowMs: number;
  /** Jeda setelah alert (ms). 0 = tanpa jeda. */
  pauseMs: number;
}
