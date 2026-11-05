import type { ScannerSettings } from '../services/scannerSettingsService.js';
import type { ScannerFilter } from './types.js';

/** Konversi nilai pengaturan (menit) menjadi filter runtime scanner (ms). */
export function toScannerFilter(settings: ScannerSettings): ScannerFilter {
  return {
    minMarketCapUsd: settings.minMarketCapUsd,
    minDevBuySol: settings.minDevBuySol,
    windowMs: settings.windowMinutes * 60_000,
    pauseMs: settings.pauseMinutes * 60_000,
  };
}

/**
 * Parse angka pengaturan scanner (market cap, dev buy, menit).
 * Menerima `$10,000`, `10.000`, `0,5`, dan `15`.
 */
export function parseScannerNumber(input: string): number | null {
  let normalized = input
    .trim()
    .replace(/\s*(?:sol|usd|menit|minutes?|mins?|m)$/i, '')
    .replace(/\s+/g, '')
    .replace(/^\$/, '')
    .replace(/%$/, '');

  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/[.,]/g, '');
  } else {
    normalized = normalized.replace(',', '.');
  }

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) {
    return null;
  }
  return value;
}
