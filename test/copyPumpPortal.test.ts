import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
} from '@solana/web3.js';
import type { CopyTradeConfig } from '../src/copyTrade/config.js';
import { executeBuy } from '../src/copyTrade/pumpPortalLocal.js';

function tradeConfig(): CopyTradeConfig {
  return {
    enabled: true,
    dryRun: false,
    amountSol: 0.01,
    tpPct: 0,
    slPct: 0,
    maxAgeMs: 0,
    slippage: 10,
    priorityFee: 0,
    pool: 'auto',
    pollMs: 1_000,
    monitorMs: 1_000,
    maxPositions: 1,
    provider: 'rpc',
    rpcUrl: 'https://rpc.example',
    heliusApiKey: null,
  };
}

function createTransaction(payer: Keypair): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions: [
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

test('buy confirmation uses the submitted signature and reports failed transactions', async () => {
  const payer = Keypair.generate();
  const transactionBytes = createTransaction(payer).serialize();
  const originalFetch = globalThis.fetch;
  let confirmedSignature: string | null = null;
  let confirmationError: unknown = null;
  const connection = {
    sendRawTransaction: async () => 'submitted-signature',
    confirmTransaction: async (signature: string) => {
      confirmedSignature = signature;
      return { context: { slot: 1 }, value: { err: confirmationError } };
    },
  } as unknown as Connection;

  globalThis.fetch = async () => new Response(transactionBytes);
  try {
    const signature = await executeBuy(
      connection,
      payer,
      tradeConfig(),
      'mint',
    );
    assert.equal(signature, 'submitted-signature');
    assert.equal(confirmedSignature, 'submitted-signature');

    confirmationError = { InstructionError: [0, 'Custom'] };
    await assert.rejects(
      executeBuy(connection, payer, tradeConfig(), 'mint'),
      /gagal dikonfirmasi/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('aborted buy does not submit the transaction', async () => {
  const payer = Keypair.generate();
  const transactionBytes = createTransaction(payer).serialize();
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let submitted = false;
  const connection = {
    sendRawTransaction: async () => {
      submitted = true;
      return 'submitted-signature';
    },
    confirmTransaction: async () => ({
      context: { slot: 1 },
      value: { err: null },
    }),
  } as unknown as Connection;

  globalThis.fetch = async () => new Response(transactionBytes);
  controller.abort();
  try {
    await assert.rejects(
      executeBuy(connection, payer, tradeConfig(), 'mint', controller.signal),
      /dihentikan sebelum transaksi dikirim/,
    );
    assert.equal(submitted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
