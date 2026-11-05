import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAlert, formatBuyResult } from '../src/scanner/format.js';

const token = {
  mint: 'MintAddress123',
  name: 'Test_Token',
  symbol: 'TST',
  traderPublicKey: 'DevAddress456',
  marketCapSol: 30,
};

test('formatAlert memakai bahasa Indonesia tanpa teks campuran', () => {
  const text = formatAlert(token, 2.5, 15_000, 'id');

  assert.ok(text.includes('🚨 *TOKEN BARU*'));
  assert.ok(!text.includes('NEW TOKEN'));
  assert.ok(text.includes('💸 Pembelian dev: *2.50 SOL*'));
  assert.ok(text.includes('⚠️ +18 | DYOR — bukan saran investasi.'));
});

test('formatAlert memakai bahasa Inggris tanpa teks campuran', () => {
  const text = formatAlert(token, 2.5, 15_000, 'en');

  assert.ok(text.includes('🚨 *NEW TOKEN*'));
  assert.ok(!text.includes('TOKEN BARU'));
  assert.ok(text.includes('💸 Dev buy: *2.50 SOL*'));
  assert.ok(text.includes('⚠️ +18 | DYOR — not financial advice.'));
});

test('formatAlert berisi info token, mcap, link, dan escape Markdown', () => {
  const text = formatAlert(token, 2.5, 15_000, 'id');

  assert.ok(text.includes('MintAddress123'));
  assert.ok(text.includes('DevAddress456'));
  assert.ok(text.includes('$15,000'));
  assert.ok(text.includes('pump.fun/coin/MintAddress123'));
  assert.ok(text.includes('solscan.io/token/MintAddress123'));
  assert.ok(text.includes('Test\\_Token'), 'nama token harus di-escape untuk Markdown');
});

test('formatAlert memakai SOL market cap bila harga USD belum ada', () => {
  const text = formatAlert({ ...token, marketCapSol: 42.5 }, 1, null, 'en');

  assert.ok(text.includes('~42.5 SOL'));
  assert.ok(!text.includes('$'));
});

test('formatBuyResult menampilkan detail buy sukses', () => {
  const text = formatBuyResult(
    {
      ok: true,
      mint: 'MintAddress123',
      symbol: 'TST',
      amountSol: 0.05,
      priceUsd: 0.001234,
      signature: 'sig123',
      dryRun: false,
    },
    'id',
  );

  assert.ok(text.includes('✅ *BUY BERHASIL*'));
  assert.ok(text.includes('TST'));
  assert.ok(text.includes('MintAddress123'));
  assert.ok(text.includes('*0.05 SOL*'));
  assert.ok(text.includes('$0.001234'));
  assert.ok(text.includes('`sig123`'));
});

test('formatBuyResult menandai simulasi dan tanpa transaksi', () => {
  const text = formatBuyResult(
    {
      ok: true,
      mint: 'MintAddress123',
      symbol: null,
      amountSol: 0.01,
      priceUsd: null,
      signature: null,
      dryRun: true,
    },
    'en',
  );

  assert.ok(text.includes('✅ *BUY SUCCESSFUL*'));
  assert.ok(text.includes('🧪 SIMULATION'));
  assert.ok(text.includes('simulation (no transaction)'));
});

test('formatBuyResult menerjemahkan alasan gagal yang umum', () => {
  const duplicate = formatBuyResult({ ok: false, reason: 'exists' }, 'id');
  assert.ok(duplicate.includes('⚠️ *BUY GAGAL*'));
  assert.ok(duplicate.includes('sudah punya posisi terbuka'));

  const max = formatBuyResult({ ok: false, reason: 'max' }, 'en');
  assert.ok(max.includes('maximum limit'));

  const failed = formatBuyResult(
    { ok: false, reason: 'failed', message: 'boom' },
    'en',
  );
  assert.ok(failed.includes('Buy execution failed: boom'));
});
