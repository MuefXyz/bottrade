import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  devBuyReached,
  isMarketCapEligible,
  tradeSolAmount,
} from '../src/scanner/logic.js';

test('isMarketCapEligible respects the USD threshold', () => {
  assert.equal(isMarketCapEligible(10, 200, 10_000), false); // $2.000 < $10.000
  assert.equal(isMarketCapEligible(60, 200, 10_000), true); // $12.000 >= $10.000
  assert.equal(isMarketCapEligible(1, 200, 0), true); // filter dimatikan
  assert.equal(isMarketCapEligible(undefined, 200, 10_000), true); // data tidak lengkap
  assert.equal(isMarketCapEligible(100, null, 10_000), true); // harga SOL belum ada
});

test('devBuyReached compares accumulated SOL against the threshold', () => {
  assert.equal(devBuyReached(1.99, 2), false);
  assert.equal(devBuyReached(2, 2), true);
  assert.equal(devBuyReached(3.5, 2), true);
});

test('tradeSolAmount prefers the explicit solAmount field', () => {
  assert.equal(
    tradeSolAmount({ txType: 'buy', solAmount: 0.75, tokenAmount: 1, vTokensInBondingCurve: 1, vSolInBondingCurve: 1 }),
    0.75,
  );
});

test('tradeSolAmount derives SOL spent on a buy from bonding curve reserves', () => {
  const amount = tradeSolAmount({
    txType: 'buy',
    tokenAmount: 100_000_000,
    vTokensInBondingCurve: 900_000_000,
    vSolInBondingCurve: 31,
  });

  assert.ok(Math.abs(amount - 3.1) < 1e-9);
});

test('tradeSolAmount derives SOL received on a sell from bonding curve reserves', () => {
  const amount = tradeSolAmount({
    txType: 'sell',
    tokenAmount: 100_000_000,
    vTokensInBondingCurve: 1_000_000_000,
    vSolInBondingCurve: 27.9,
  });

  assert.ok(Math.abs(amount - 3.1) < 1e-9);
});

test('tradeSolAmount returns 0 when data is insufficient', () => {
  assert.equal(tradeSolAmount({ txType: 'buy' }), 0);
  assert.equal(tradeSolAmount({ txType: 'complete', tokenAmount: 1 }), 0);
});
