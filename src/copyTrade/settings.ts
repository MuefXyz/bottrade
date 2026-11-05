export function parsePnlPercent(input: string): number | null {
  const normalized = input.trim().replace(/%$/, '').replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Parse nominal beli dalam SOL, mis. "0.01", "0,05", atau "0.01 SOL". */
export function parseSolAmount(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/\s*sol$/i, '')
    .replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 1000) return null;
  return value;
}

/** Normalisasi angka dengan satuan opsional (`SOL`, `%`, `menit`). */
function parseOptionalUnitNumber(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/\s*(?:sol|menit|minutes?|mins?|m)$/i, '')
    .replace(/\s+/g, '')
    .replace(/%$/, '')
    .replace(',', '.');

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Maksimal posisi terbuka per user: bilangan bulat 1-100. */
export function parsePositionCount(input: string): number | null {
  const value = parseOptionalUnitNumber(input);
  if (value === null || !Number.isInteger(value)) return null;
  if (value < 1 || value > 100) return null;
  return value;
}

/** Umur maksimal posisi dalam menit. 0 = nonaktif. */
export function parseAgeMinutes(input: string): number | null {
  const value = parseOptionalUnitNumber(input);
  if (value === null || value < 0 || value > 100_000) return null;
  return value;
}

/** Slippage dalam persen (0-100). */
export function parseSlippagePct(input: string): number | null {
  const value = parseOptionalUnitNumber(input);
  if (value === null || value < 0 || value > 100) return null;
  return value;
}

/** Priority fee dalam SOL (0-1). */
export function parsePriorityFee(input: string): number | null {
  const value = parseOptionalUnitNumber(input);
  if (value === null || value < 0 || value > 1) return null;
  return value;
}

export function exitReasonForPnl(
  pnlPct: number,
  takeProfitPct: number,
  stopLossPct: number,
): 'tp' | 'sl' | null {
  if (takeProfitPct > 0 && pnlPct >= takeProfitPct) return 'tp';
  if (stopLossPct > 0 && pnlPct <= -stopLossPct) return 'sl';
  return null;
}
