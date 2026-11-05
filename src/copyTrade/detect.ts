/** Token wrapped SOL — bukan target copy-trade. */
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
/** Quote token yang lazim dipakai di PumpSwap/Raydium/Jupiter. */
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

const QUOTE_MINTS = new Set([WSOL_MINT, USDC_MINT, USDT_MINT]);

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface TokenBalanceLike {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: {
    uiAmount: number | null;
    decimals: number;
    amount: string;
  };
}

export interface TransactionMetaLike {
  err: unknown;
  fee: number;
  preBalances: number[];
  postBalances: number[];
  preTokenBalances?: TokenBalanceLike[];
  postTokenBalances?: TokenBalanceLike[];
}

export interface ParsedTransactionLike {
  transaction: {
    message: {
      accountKeys: AccountKeyLike[];
    };
  };
  meta: TransactionMetaLike | null;
}

/** Format account key dari `getParsedTransaction`: string, {pubkey}, atau PublicKey. */
export type PublicKeyLike = { toBase58(): string };
export type AccountKeyLike =
  | string
  | { pubkey: string | PublicKeyLike }
  | PublicKeyLike;

export interface DetectedBuy {
  mint: string;
  tokenAmount: number;
  solSpent: number;
}

function accountKeyString(key: AccountKeyLike | undefined): string | undefined {
  if (key === undefined) return undefined;
  if (typeof key === 'string') return key;
  if ('pubkey' in key) {
    return typeof key.pubkey === 'string' ? key.pubkey : key.pubkey.toBase58();
  }
  return key.toBase58();
}

function accountKeyAt(
  accountKeys: ParsedTransactionLike['transaction']['message']['accountKeys'],
  index: number,
): string | undefined {
  return accountKeyString(accountKeys[index]);
}

function tokenAmountOf(balance: TokenBalanceLike): number {
  if (balance.uiTokenAmount.uiAmount !== null) {
    return balance.uiTokenAmount.uiAmount;
  }
  return Number(balance.uiTokenAmount.amount) / 10 ** balance.uiTokenAmount.decimals;
}

/**
 * Deteksi token yang baru dibeli oleh `owner` dalam satu transaksi.
 *
 * Logika:
 * - Selisih saldo token owner per mint harus > 0 (token masuk).
 * - Harus ada nilai yang keluar dari wallet: SOL (di luar fee) ATAU quote token
 *   (USDC/USDT/WSOL) berkurang. Ini mendukung buy yang dibayar pakai stablecoin.
 * - Quote token diabaikan sebagai target copy-trade.
 */
export function boughtMints(
  tx: ParsedTransactionLike,
  owner: string,
): DetectedBuy[] {
  const meta = tx.meta;
  if (meta === null || meta.err !== null) return [];

  const accountKeys = tx.transaction.message.accountKeys;
  const ownerIndex = accountKeys.findIndex(
    (key) => accountKeyString(key) === owner,
  );
  if (ownerIndex < 0) return [];

  const pre = meta.preBalances[ownerIndex] ?? 0;
  const post = meta.postBalances[ownerIndex] ?? 0;
  let lamportsSpent = pre - post;
  // Fee payer membayar fee dari saldo yang sama, jadi keluarkan dari biaya token.
  if (ownerIndex === 0) lamportsSpent -= meta.fee;
  const solSpent = lamportsSpent / LAMPORTS_PER_SOL;

  const belongsToOwner = (balance: TokenBalanceLike): boolean => {
    if (balance.owner !== undefined) return balance.owner === owner;
    return accountKeyAt(accountKeys, balance.accountIndex) === owner;
  };

  const before = new Map<string, number>();
  for (const balance of meta.preTokenBalances ?? []) {
    if (!belongsToOwner(balance)) continue;
    before.set(balance.mint, (before.get(balance.mint) ?? 0) + tokenAmountOf(balance));
  }

  const after = new Map<string, number>();
  for (const balance of meta.postTokenBalances ?? []) {
    if (!belongsToOwner(balance)) continue;
    after.set(balance.mint, (after.get(balance.mint) ?? 0) + tokenAmountOf(balance));
  }

  // Buy yang dibayar USDC/USDT/WSOL tidak terlihat dari SOL keluar (hanya fee).
  const quoteSpent = [...QUOTE_MINTS].some((mint) => {
    const delta = (before.get(mint) ?? 0) - (after.get(mint) ?? 0);
    return delta > 0;
  });

  if (solSpent <= 0 && !quoteSpent) return [];

  const buys: DetectedBuy[] = [];
  for (const [mint, afterAmount] of after) {
    if (QUOTE_MINTS.has(mint)) continue;
    const delta = afterAmount - (before.get(mint) ?? 0);
    if (delta <= 0) continue;

    buys.push({
      mint,
      tokenAmount: delta,
      solSpent: Math.max(0, solSpent),
    });
  }

  return buys;
}
