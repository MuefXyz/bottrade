import {
  Keypair,
  VersionedTransaction,
  type Connection,
} from '@solana/web3.js';
import type { CopyTradeConfig } from './config.js';

const TRADE_LOCAL_URL = 'https://pumpportal.fun/api/trade-local';

interface TradeLocalPayload {
  publicKey: string;
  action: 'buy' | 'sell';
  mint: string;
  amount: number | string;
  denominatedInSol: 'true' | 'false';
  slippage: number;
  priorityFee: number;
  pool: string;
}

async function requestLocalTransaction(
  payload: TradeLocalPayload,
  signal?: AbortSignal,
): Promise<VersionedTransaction> {
  const response = await fetch(TRADE_LOCAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...(signal === undefined ? {} : { signal }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw new Error(`PumpPortal trade-local ${response.status}: ${detail}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return VersionedTransaction.deserialize(bytes);
}

async function signAndSend(
  connection: Connection,
  transaction: VersionedTransaction,
  keypair: Keypair,
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal);
  transaction.sign([keypair]);
  throwIfAborted(signal);

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
    preflightCommitment: 'confirmed',
  });

  const confirmation = await connection.confirmTransaction(signature, 'confirmed');
  if (confirmation.value.err !== null) {
    throw new Error(
      `Transaksi ${signature} gagal dikonfirmasi: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  return signature;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error('Copy-trade dihentikan sebelum transaksi dikirim.');
  error.name = 'AbortError';
  throw error;
}

/** Beli token via PumpPortal Local Transaction API (gratis, signing lokal). */
export async function executeBuy(
  connection: Connection,
  keypair: Keypair,
  config: CopyTradeConfig,
  mint: string,
  signal?: AbortSignal,
): Promise<string> {
  const transaction = await requestLocalTransaction(
    {
      publicKey: keypair.publicKey.toBase58(),
      action: 'buy',
      mint,
      amount: config.amountSol,
      denominatedInSol: 'true',
      slippage: config.slippage,
      priorityFee: config.priorityFee,
      pool: config.pool,
    },
    signal,
  );

  return signAndSend(connection, transaction, keypair, signal);
}

/** Jual 100% token yang dipegang via PumpPortal Local Transaction API. */
export async function executeSell(
  connection: Connection,
  keypair: Keypair,
  config: CopyTradeConfig,
  mint: string,
): Promise<string> {
  const transaction = await requestLocalTransaction({
    publicKey: keypair.publicKey.toBase58(),
    action: 'sell',
    mint,
    amount: '100%',
    denominatedInSol: 'false',
    slippage: config.slippage,
    priorityFee: config.priorityFee,
    pool: config.pool,
  });

  return signAndSend(connection, transaction, keypair);
}
