import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenScanner } from '../src/scanner/scanner.js';
import { parseScannerNumber, toScannerFilter } from '../src/scanner/settings.js';

test('parseScannerNumber menerima angka, dolar, dan pemisah ribuan', () => {
  assert.equal(parseScannerNumber('10000'), 10000);
  assert.equal(parseScannerNumber('$10,000'), 10000);
  assert.equal(parseScannerNumber('10.000'), 10000);
  assert.equal(parseScannerNumber('0,5'), 0.5);
  assert.equal(parseScannerNumber(' 15 menit '), 15);
  assert.equal(parseScannerNumber('0'), 0);
});

test('parseScannerNumber menolak nilai negatif dan format tidak valid', () => {
  assert.equal(parseScannerNumber('-1'), null);
  assert.equal(parseScannerNumber('abc'), null);
  assert.equal(parseScannerNumber('1,2,3'), null);
  assert.equal(parseScannerNumber(''), null);
});

test('toScannerFilter mengubah menit menjadi milidetik', () => {
  assert.deepEqual(
    toScannerFilter({
      minMarketCapUsd: 10_000,
      minDevBuySol: 2,
      windowMinutes: 60,
      pauseMinutes: 15,
    }),
    {
      minMarketCapUsd: 10_000,
      minDevBuySol: 2,
      windowMs: 3_600_000,
      pauseMs: 900_000,
    },
  );
});

test('TokenScanner memakai filter default lalu menerima filter per chat', () => {
  const scanner = new TokenScanner(
    {
      enabled: true,
      autostart: false,
      apiKey: null,
      devBuyMinSol: 2,
      devBuyWindowMs: 60_000,
      minMarketCapUsd: 10_000,
      pauseMs: 900_000,
    },
    () => 0,
  );

  assert.deepEqual(scanner.getFilter(42), {
    minMarketCapUsd: 10_000,
    minDevBuySol: 2,
    windowMs: 60_000,
    pauseMs: 900_000,
  });

  scanner.setFilter(42, {
    minMarketCapUsd: 2_500,
    minDevBuySol: 0.5,
    windowMs: 3_600_000,
    pauseMs: 60_000,
  });

  assert.deepEqual(scanner.getFilter(42), {
    minMarketCapUsd: 2_500,
    minDevBuySol: 0.5,
    windowMs: 3_600_000,
    pauseMs: 60_000,
  });
});
