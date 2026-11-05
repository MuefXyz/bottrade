export interface TradeAmountSource {
  txType: string;
  solAmount?: number;
  tokenAmount?: number;
  vTokensInBondingCurve?: number;
  vSolInBondingCurve?: number;
}

export function isMarketCapEligible(
  marketCapSol: number | undefined,
  solPriceUsd: number | null,
  minMarketCapUsd: number,
): boolean {
  if (minMarketCapUsd <= 0) return true;
  if (marketCapSol === undefined || solPriceUsd === null) return true;

  return marketCapSol * solPriceUsd >= minMarketCapUsd;
}

export function devBuyReached(totalSol: number, minSol: number): boolean {
  return totalSol >= minSol;
}

/**
 * Hitung jumlah SOL sebuah trade. Pakai `solAmount` dari event bila tersedia,
 * kalau tidak turunkan dari pergerakan virtual reserves bonding curve.
 */
export function tradeSolAmount(event: TradeAmountSource): number {
  if (
    typeof event.solAmount === 'number' &&
    Number.isFinite(event.solAmount) &&
    event.solAmount >= 0
  ) {
    return event.solAmount;
  }

  const { tokenAmount, vTokensInBondingCurve, vSolInBondingCurve } = event;
  if (
    tokenAmount === undefined ||
    tokenAmount <= 0 ||
    vTokensInBondingCurve === undefined ||
    vSolInBondingCurve === undefined
  ) {
    return 0;
  }

  const k = vSolInBondingCurve * vTokensInBondingCurve;

  if (event.txType === 'buy') {
    const tokensBefore = vTokensInBondingCurve + tokenAmount;
    if (tokensBefore <= 0) return 0;
    return Math.max(0, vSolInBondingCurve - k / tokensBefore);
  }

  if (event.txType === 'sell') {
    const tokensBefore = vTokensInBondingCurve - tokenAmount;
    if (tokensBefore <= 0) return 0;
    return Math.max(0, k / tokensBefore - vSolInBondingCurve);
  }

  return 0;
}
