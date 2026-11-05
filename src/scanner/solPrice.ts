const BINANCE_URL = 'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT';
const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

export async function fetchSolPriceUsd(fetcher: typeof fetch = fetch): Promise<number | null> {
  try {
    const response = await fetcher(BINANCE_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      const body = (await response.json()) as { price?: string };
      const price = Number(body.price);
      if (Number.isFinite(price) && price > 0) return price;
    }
  } catch {
    // fallback ke CoinGecko
  }

  try {
    const response = await fetcher(COINGECKO_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      const body = (await response.json()) as { solana?: { usd?: number } };
      const price = body.solana?.usd;
      if (typeof price === 'number' && Number.isFinite(price) && price > 0) return price;
    }
  } catch {
    // tidak ada sumber harga yang bisa dipakai
  }

  return null;
}

export class SolPriceCache {
  private priceUsd: number | null = null;
  private fetchedAt = 0;

  get(): number | null {
    return this.priceUsd;
  }

  async refresh(): Promise<number | null> {
    if (Date.now() - this.fetchedAt < CACHE_TTL_MS) return this.priceUsd;

    const price = await fetchSolPriceUsd();
    if (price !== null) {
      this.priceUsd = price;
      this.fetchedAt = Date.now();
    }

    return this.priceUsd;
  }
}
