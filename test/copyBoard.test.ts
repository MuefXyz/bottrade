import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPositionBoard } from '../src/copyTrade/format.js';
import type { CopyPositionView } from '../src/copyTrade/types.js';
import { copyTradeBoardKeyboard } from '../src/keyboards/mainMenu.js';

const POSITION: CopyPositionView = {
  id: 7,
  mint: '9UuBKMwmvB4FWcFF6W1UKwwQjeYN8AzzjN33sQx9pump',
  symbol: 'TEST',
  amountSol: 0.01,
  entryPriceUsd: 0.00002,
  currentPriceUsd: 0.00003,
  pnlPct: 50,
  dryRun: true,
};

test('board posisi menampilkan harga masuk, harga kini, dan PnL live', () => {
  const text = formatPositionBoard([POSITION], 'id', { updatedAt: 0 });

  assert.match(text, /COPY TRADE — POSISI TERBUKA/);
  assert.match(text, /SIMULASI/);
  assert.match(text, /TEST/);
  assert.match(text, /Harga masuk: \$0\.00002000/);
  assert.match(text, /Harga kini: \$0\.00003000/);
  assert.match(text, /\+50\.00%/);
  assert.match(text, /Update:/);
});

test('board kosong tetap bisa menampilkan event penutupan posisi', () => {
  const text = formatPositionBoard([], 'en', {
    updatedAt: 0,
    notice: {
      kind: 'sell',
      mint: POSITION.mint,
      symbol: 'TEST',
      reason: 'manual',
      pnlPct: 12.5,
      closePriceUsd: 0.00003,
      signature: null,
      dryRun: true,
    },
  });

  assert.match(text, /No open positions yet/);
  assert.match(text, /Position closed/);
  assert.match(text, /\+12\.50%/);
  assert.match(text, /Manual close/);
});

test('board menandai harga yang belum tersedia', () => {
  const text = formatPositionBoard(
    [{ ...POSITION, currentPriceUsd: null, pnlPct: null }],
    'id',
    { updatedAt: 0 },
  );

  assert.match(text, /menunggu harga/);
  assert.match(text, /⚪ \*\?\*/);
});

test('judul board bisa dikustom untuk panel Posisi Terbuka', () => {
  const text = formatPositionBoard([], 'id', {
    title: '📈 *POSISI TERBUKA*',
    updatedAt: 0,
  });

  assert.match(text, /POSISI TERBUKA/);
  assert.doesNotMatch(text, /COPY TRADE/);
});

test('setiap posisi mendapat tombol close dengan id-nya sendiri', () => {
  const keyboard = copyTradeBoardKeyboard('id', [
    { id: 7, symbol: 'TEST', mint: POSITION.mint },
    {
      id: 9,
      symbol: null,
      mint: 'So11111111111111111111111111111111111111112',
    },
  ]);

  const callbacks = keyboard.inline_keyboard
    .flat()
    .map((button) => ('callback_data' in button ? button.callback_data : null));

  assert.deepEqual(callbacks, ['copy:close:7', 'copy:close:9']);
});
