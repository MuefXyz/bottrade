import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boughtMints, type ParsedTransactionLike } from '../src/copyTrade/detect.js';

const OWNER = 'OwnerWallet111111111111111111111111111111';
const TOKEN_MINT = 'TokenMint11111111111111111111111111111111';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

function makeTx(options: {
  ownerIndex?: number;
  preSol: number;
  postSol: number;
  fee?: number;
  pre?: Array<{ mint: string; amount: number; owner?: string; accountIndex?: number }>;
  post?: Array<{ mint: string; amount: number; owner?: string; accountIndex?: number }>;
  err?: unknown;
}): ParsedTransactionLike {
  const ownerIndex = options.ownerIndex ?? 0;
  const accountKeys = [0, 1].map((index) =>
    index === ownerIndex ? OWNER : 'OtherWallet1111111111111111111111111111111',
  );

  const balances = (
    entries: Array<{ mint: string; amount: number; owner?: string; accountIndex?: number }>,
  ) =>
    entries.map((entry) => ({
      accountIndex: entry.accountIndex ?? 2,
      mint: entry.mint,
      owner: entry.owner ?? OWNER,
      uiTokenAmount: {
        uiAmount: entry.amount,
        decimals: 6,
        amount: String(Math.round(entry.amount * 1_000_000)),
      },
    }));

  return {
    transaction: { message: { accountKeys: accountKeys.map((pubkey) => ({ pubkey })) } },
    meta: {
      err: options.err ?? null,
      fee: options.fee ?? 5_000,
      preBalances: accountKeys.map((_, index) =>
        index === ownerIndex ? options.preSol : 0,
      ),
      postBalances: accountKeys.map((_, index) =>
        index === ownerIndex ? options.postSol : 0,
      ),
      preTokenBalances: balances(options.pre ?? []),
      postTokenBalances: balances(options.post ?? []),
    },
  };
}

test('mendeteksi token yang dibeli dari selisih saldo token + SOL keluar', () => {
  const tx = makeTx({
    preSol: 1_000_000_000,
    postSol: 1_000_000_000 - 100_000_000 - 5_000,
    post: [{ mint: TOKEN_MINT, amount: 1_000 }],
  });

  const buys = boughtMints(tx, OWNER);

  assert.equal(buys.length, 1);
  assert.equal(buys[0].mint, TOKEN_MINT);
  assert.equal(buys[0].tokenAmount, 1_000);
  assert.equal(Number(buys[0].solSpent.toFixed(4)), 0.1);
});

test('tidak mendeteksi transaksi jual (saldo token turun)', () => {
  const tx = makeTx({
    preSol: 1_000_000_000,
    postSol: 1_100_000_000,
    pre: [{ mint: TOKEN_MINT, amount: 1_000 }],
    post: [],
  });

  assert.deepEqual(boughtMints(tx, OWNER), []);
});

test('mengabaikan mint WSOL karena hanya bagian pembayaran', () => {
  const tx = makeTx({
    preSol: 1_000_000_000,
    postSol: 900_000_000,
    post: [{ mint: WSOL_MINT, amount: 0.1 }],
  });

  assert.deepEqual(boughtMints(tx, OWNER), []);
});

test('hanya menghitung token milik owner', () => {
  const tx = makeTx({
    preSol: 1_000_000_000,
    postSol: 900_000_000,
    post: [
      { mint: TOKEN_MINT, amount: 1_000, owner: 'SomeoneElse' },
      { mint: 'OtherMint111111111111111111111111111111111', amount: 50 },
    ],
  });

  const buys = boughtMints(tx, OWNER);

  assert.equal(buys.length, 1);
  assert.equal(buys[0].mint, 'OtherMint111111111111111111111111111111111');
});

test('transaksi gagal atau owner tidak ada tidak menghasilkan buy', () => {
  const failed = makeTx({
    preSol: 1_000_000_000,
    postSol: 900_000_000,
    post: [{ mint: TOKEN_MINT, amount: 1_000 }],
    err: { InstructionError: [0, 'Custom'] },
  });
  assert.deepEqual(boughtMints(failed, OWNER), []);

  const ok = makeTx({
    preSol: 1_000_000_000,
    postSol: 900_000_000,
    post: [{ mint: TOKEN_MINT, amount: 1_000 }],
  });
  assert.deepEqual(boughtMints(ok, 'NotInTransaction'), []);
});

test('owner bukan fee payer: fee tidak dikurangkan dari biaya token', () => {
  const tx = makeTx({
    ownerIndex: 1,
    preSol: 2_000_000_000,
    postSol: 1_900_000_000,
    post: [{ mint: TOKEN_MINT, amount: 1_000 }],
  });

  const buys = boughtMints(tx, OWNER);
  assert.equal(buys.length, 1);
  assert.equal(Number(buys[0].solSpent.toFixed(4)), 0.1);
});

test('mendeteksi buy yang dibayar USDC meski SOL hanya berkurang untuk fee', () => {
  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const tx = makeTx({
    preSol: 1_000_000_000,
    postSol: 1_000_000_000 - 5_000,
    pre: [{ mint: USDC, amount: 100 }],
    post: [
      { mint: USDC, amount: 90 },
      { mint: TOKEN_MINT, amount: 1_000 },
    ],
  });

  const buys = boughtMints(tx, OWNER);

  assert.equal(buys.length, 1);
  assert.equal(buys[0].mint, TOKEN_MINT);
  assert.equal(buys[0].solSpent, 0);
});

test('mendeteksi buy yang dibayar WSOL tanpa menjadikan WSOL target', () => {
  const tx = makeTx({
    preSol: 1_000_000_000,
    postSol: 1_000_000_000 - 5_000,
    pre: [{ mint: WSOL_MINT, amount: 1 }],
    post: [
      { mint: WSOL_MINT, amount: 0.5 },
      { mint: TOKEN_MINT, amount: 1_000 },
    ],
  });

  const buys = boughtMints(tx, OWNER);

  assert.equal(buys.length, 1);
  assert.equal(buys[0].mint, TOKEN_MINT);
});

test('transfer token masuk tanpa nilai keluar bukan buy', () => {
  const tx = makeTx({
    preSol: 1_000_000_000,
    postSol: 1_000_000_000 - 5_000,
    post: [{ mint: TOKEN_MINT, amount: 1_000 }],
  });

  assert.deepEqual(boughtMints(tx, OWNER), []);
});

test('mendukung accountKeys objek PublicKey dari getParsedTransaction', () => {
  const tx = makeTx({
    preSol: 1_000_000_000,
    postSol: 1_000_000_000 - 105_000,
    post: [{ mint: TOKEN_MINT, amount: 1_000 }],
  });

  // Bentuk nyata transaksi version 1: { pubkey: PublicKey(...), signer, ... }
  tx.transaction.message.accountKeys = [
    { pubkey: { toBase58: () => OWNER } },
    { pubkey: { toBase58: () => 'OtherWallet1111111111111111111111111111111' } },
  ];

  const buys = boughtMints(tx, OWNER);

  assert.equal(buys.length, 1);
  assert.equal(buys[0].mint, TOKEN_MINT);
});
