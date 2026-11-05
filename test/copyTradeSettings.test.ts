import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exitReasonForPnl,
  parseAgeMinutes,
  parsePnlPercent,
  parsePositionCount,
  parsePriorityFee,
  parseSlippagePct,
  parseSolAmount,
} from '../src/copyTrade/settings.js';

test('parsePnlPercent accepts non-negative percentages and optional percent signs', () => {
  assert.equal(parsePnlPercent('50'), 50);
  assert.equal(parsePnlPercent('12.5%'), 12.5);
  assert.equal(parsePnlPercent('12,5%'), 12.5);
  assert.equal(parsePnlPercent('0'), 0);
});

test('parsePnlPercent rejects negative, malformed, and non-finite values', () => {
  assert.equal(parsePnlPercent('-1'), null);
  assert.equal(parsePnlPercent('NaN'), null);
  assert.equal(parsePnlPercent('Infinity'), null);
  assert.equal(parsePnlPercent('10abc'), null);
  assert.equal(parsePnlPercent('1,2,3'), null);
});

test('exitReasonForPnl applies configured thresholds and treats zero as disabled', () => {
  assert.equal(exitReasonForPnl(50, 50, 25), 'tp');
  assert.equal(exitReasonForPnl(-25, 50, 25), 'sl');
  assert.equal(exitReasonForPnl(49.99, 50, 25), null);
  assert.equal(exitReasonForPnl(-24.99, 50, 25), null);
  assert.equal(exitReasonForPnl(100, 0, 0), null);
});

test('parseSolAmount menerima nominal SOL positif dan format umum', () => {
  assert.equal(parseSolAmount('0.01'), 0.01);
  assert.equal(parseSolAmount('0,05'), 0.05);
  assert.equal(parseSolAmount(' 0.25 SOL '), 0.25);
  assert.equal(parseSolAmount('1'), 1);
});

test('parseSolAmount menolak nol, negatif, dan format tidak valid', () => {
  assert.equal(parseSolAmount('0'), null);
  assert.equal(parseSolAmount('-0.01'), null);
  assert.equal(parseSolAmount('abc'), null);
  assert.equal(parseSolAmount('0.01 SOL SOL'), null);
  assert.equal(parseSolAmount('1001'), null);
});

test('parsePositionCount menerima bilangan bulat 1-100 saja', () => {
  assert.equal(parsePositionCount('5'), 5);
  assert.equal(parsePositionCount(' 100 '), 100);
  assert.equal(parsePositionCount('1'), 1);
  assert.equal(parsePositionCount('0'), null);
  assert.equal(parsePositionCount('101'), null);
  assert.equal(parsePositionCount('2.5'), null);
  assert.equal(parsePositionCount('abc'), null);
});

test('parseAgeMinutes menerima 0 sampai batas wajar', () => {
  assert.equal(parseAgeMinutes('0'), 0);
  assert.equal(parseAgeMinutes('30'), 30);
  assert.equal(parseAgeMinutes('30 menit'), 30);
  assert.equal(parseAgeMinutes('1,5'), 1.5);
  assert.equal(parseAgeMinutes('-1'), null);
  assert.equal(parseAgeMinutes('abc'), null);
});

test('parseSlippagePct membatasi 0-100 persen', () => {
  assert.equal(parseSlippagePct('15'), 15);
  assert.equal(parseSlippagePct('15%'), 15);
  assert.equal(parseSlippagePct('0'), 0);
  assert.equal(parseSlippagePct('100'), 100);
  assert.equal(parseSlippagePct('101'), null);
  assert.equal(parseSlippagePct('-5'), null);
});

test('parsePriorityFee menerima 0-1 SOL', () => {
  assert.equal(parsePriorityFee('0.0001'), 0.0001);
  assert.equal(parsePriorityFee('0,0001 SOL'), 0.0001);
  assert.equal(parsePriorityFee('0'), 0);
  assert.equal(parsePriorityFee('1'), 1);
  assert.equal(parsePriorityFee('1.5'), null);
  assert.equal(parsePriorityFee('-0.1'), null);
});
