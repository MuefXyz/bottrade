import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLang, t } from '../src/i18n.js';

test('normalizeLang defaults to Indonesian', () => {
  assert.equal(normalizeLang(undefined), 'id');
  assert.equal(normalizeLang(null), 'id');
  assert.equal(normalizeLang('id'), 'id');
});

test('normalizeLang keeps English', () => {
  assert.equal(normalizeLang('en'), 'en');
});

test('t returns text for each supported language', () => {
  for (const lang of ['id', 'en'] as const) {
    assert.ok(t(lang, 'welcomeTitle').length > 0);
    assert.ok(t(lang, 'disclaimer').includes('18'));
  }
});
