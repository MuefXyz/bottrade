import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { USER_GUIDE_PDF } from '../src/handlers/help.js';

test('PDF panduan tersedia saat tombol Bantuan ditekan', () => {
  assert.ok(statSync(USER_GUIDE_PDF).size > 0, 'file PDF panduan kosong');

  const header = readFileSync(USER_GUIDE_PDF).subarray(0, 5).toString('ascii');
  assert.equal(header, '%PDF-');
});
