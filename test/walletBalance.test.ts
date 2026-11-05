import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LAMPORTS_PER_SOL,
  formatSol,
} from '../src/services/walletBalanceService.js';

test('formatSol menampilkan saldo SOL tanpa nol berlebih', () => {
  assert.equal(formatSol(0), '0 SOL');
  assert.equal(formatSol(LAMPORTS_PER_SOL), '1 SOL');
  assert.equal(formatSol(1.5 * LAMPORTS_PER_SOL), '1.5 SOL');
  assert.equal(formatSol(0.25 * LAMPORTS_PER_SOL), '0.25 SOL');
  assert.equal(formatSol(1234, 6), '0.000001 SOL');
});
