import { Connection, PublicKey } from '@solana/web3.js';
import { env } from '../config.js';

export const LAMPORTS_PER_SOL = 1_000_000_000;

let connection: Connection | null = null;

/** Koneksi RPC bersama untuk baca saldo; dibuat sekali saat dibutuhkan. */
export function rpcConnection(): Connection {
  if (connection === null) {
    connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');
  }
  return connection;
}

/** Saldo wallet dalam lamports; null bila RPC gagal. */
export async function getWalletBalanceLamports(
  address: string,
): Promise<number | null> {
  try {
    return await rpcConnection().getBalance(
      new PublicKey(address),
      'confirmed',
    );
  } catch (error) {
    console.error(
      '❌ [wallet] gagal mengambil saldo:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Format lamports menjadi SOL tanpa nol berlebih, mis. `1.25 SOL`. */
export function formatSol(lamports: number, maxDecimals = 4): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  return `${sol.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  })} SOL`;
}
