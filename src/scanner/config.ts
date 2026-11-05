import { env } from '../config.js';

/**
 * Nilai default filter scanner untuk user yang belum mengatur sendiri.
 * Diambil dari kode (bukan `.env`) karena bisa diubah lewat ⚙️ Pengaturan.
 */
export const SCANNER_DEFAULTS = {
  devBuyMinSol: 2,
  devBuyWindowMinutes: 60,
  minMarketCapUsd: 10_000,
  pauseMinutes: 15,
} as const;

export interface ScannerConfig {
  enabled: boolean;
  autostart: boolean;
  apiKey: string | null;
  devBuyMinSol: number;
  devBuyWindowMs: number;
  minMarketCapUsd: number;
  pauseMs: number;
}

export function buildScannerConfig(): ScannerConfig {
  return {
    enabled: env.SCANNER_ENABLED === 'true',
    autostart: env.SCANNER_AUTOSTART === 'true',
    apiKey: env.PUMPPORTAL_API_KEY?.trim() || null,
    devBuyMinSol: SCANNER_DEFAULTS.devBuyMinSol,
    devBuyWindowMs: SCANNER_DEFAULTS.devBuyWindowMinutes * 60_000,
    minMarketCapUsd: SCANNER_DEFAULTS.minMarketCapUsd,
    pauseMs: SCANNER_DEFAULTS.pauseMinutes * 60_000,
  };
}
