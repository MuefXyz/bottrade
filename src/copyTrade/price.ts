const DEXSCREENER_URL = 'https://api.dexscreener.com/latest/dex/tokens/';
const CACHE_TTL_MS = 15_000;

export interface TokenPrice {
  priceUsd: number;
  symbol: string | null;
  name: string | null;
  liquidityUsd: number | null;
}

interface DexPair {
  baseToken?: { address?: string; symbol?: string; name?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
}

interface DexResponse {
  pairs?: DexPair[] | null;
}

/**
 * Harga token dari DexScreener (gratis, tanpa API key).
 * Cache 15 detik agar monitor TP/SL tidak membanjiri API.
 */
export class TokenPriceCache {
  private readonly cache = new Map<
    string,
    { expiresAt: number; price: TokenPrice | null }
  >();

  constructor(private readonly now: () => number = Date.now) {}

  async get(mint: string): Promise<TokenPrice | null> {
    const cached = this.cache.get(mint);
    if (cached !== undefined && this.now() < cached.expiresAt) {
      return cached.price;
    }

    let price: TokenPrice | null = null;
    try {
      price = await fetchPrice(mint);
    } catch {
      price = null;
    }

    this.cache.set(mint, { expiresAt: this.now() + CACHE_TTL_MS, price });
    return price;
  }
}

function pickBestPair(pairs: DexPair[]): DexPair | null {
  let best: DexPair | null = null;
  let bestLiquidity = -1;

  for (const pair of pairs) {
    const liquidity = pair.liquidity?.usd ?? 0;
    if (liquidity > bestLiquidity) {
      best = pair;
      bestLiquidity = liquidity;
    }
  }

  return best;
}

async function fetchPrice(mint: string): Promise<TokenPrice | null> {
  const response = await fetch(`${DEXSCREENER_URL}${mint}`);
  if (!response.ok) return null;

  const data = (await response.json()) as DexResponse;
  const pairs = data.pairs ?? [];
  const best = pickBestPair(pairs);
  if (best === null) return null;

  const priceUsd = Number(best.priceUsd);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

  return {
    priceUsd,
    symbol: best.baseToken?.symbol ?? null,
    name: best.baseToken?.name ?? null,
    liquidityUsd: best.liquidity?.usd ?? null,
  };
}
