import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeMarkdown } from '../src/utils/markdown.js';

test('escapeMarkdown meng-escape karakter spesial Markdown Telegram', () => {
  assert.equal(escapeMarkdown('Fauchat_x'), 'Fauchat\\_x');
  assert.equal(escapeMarkdown('a*b`c[d]'), 'a\\*b\\`c\\[d\\]');
  assert.equal(escapeMarkdown('Muaifi'), 'Muaifi');
  assert.equal(escapeMarkdown(''), '');
});
