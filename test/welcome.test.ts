import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWelcomeText } from '../src/handlers/start.js';

test('welcome text contains the +18 disclaimer in both languages', () => {
  for (const lang of ['id', 'en'] as const) {
    const text = buildWelcomeText(lang);
    assert.ok(text.includes('18'), `disclaimer +18 hilang untuk bahasa ${lang}`);
    assert.ok(text.length > 0);
  }
});

test('welcome text differs between languages', () => {
  assert.notEqual(buildWelcomeText('id'), buildWelcomeText('en'));
});
