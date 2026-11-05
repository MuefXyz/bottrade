import { test } from 'node:test';
import assert from 'node:assert/strict';
import { helpInlineKeyboard } from '../src/keyboards/mainMenu.js';
import { adminChatUrl } from '../src/utils/admin.js';

test('adminChatUrl menerima ID numerik, username, dan URL lengkap', () => {
  assert.equal(adminChatUrl('8121584526'), 'tg://user?id=8121584526');
  assert.equal(adminChatUrl('@Fauchat_x'), 'https://t.me/Fauchat_x');
  assert.equal(adminChatUrl('Fauchat_x'), 'https://t.me/Fauchat_x');
  assert.equal(adminChatUrl('https://t.me/Fauchat_x'), 'https://t.me/Fauchat_x');
  assert.equal(adminChatUrl('t.me/Fauchat_x'), 'https://t.me/Fauchat_x');
  assert.equal(adminChatUrl('tg://user?id=8121584526'), 'tg://user?id=8121584526');
});

test('adminChatUrl mengembalikan null untuk nilai kosong atau tidak valid', () => {
  assert.equal(adminChatUrl(''), null);
  assert.equal(adminChatUrl('   '), null);
  assert.equal(adminChatUrl('abc'), null);
});

test('help keyboard menampilkan tombol admin hanya bila ADMIN_ID diisi', () => {
  const keyboard = helpInlineKeyboard('id', 'tg://user?id=8121584526');
  assert.ok(keyboard);

  const button = keyboard.inline_keyboard[0][0];
  assert.equal(button.text, '👤 Chat Admin');
  assert.equal('url' in button ? button.url : undefined, 'tg://user?id=8121584526');

  assert.equal(helpInlineKeyboard('id', null), undefined);
});
