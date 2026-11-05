import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GrammyError, type Api } from 'grammy';
import { ScannerNotifier } from '../src/scanner/notifier.js';
import type { AlertPayload } from '../src/scanner/types.js';

const alert: AlertPayload = {
  token: {
    mint: 'MintAddress123',
    name: 'Token',
    symbol: 'TKN',
    traderPublicKey: 'DevAddress456',
    marketCapSol: 30,
  },
  devBuySol: 1.5,
  marketCapUsd: 5_000,
};

function setup(options: { failEdit?: Error } = {}) {
  const calls = {
    edits: [] as Array<{ chatId: number; messageId: number; text: string }>,
    sends: [] as Array<{ chatId: number; text: string }>,
    deletes: [] as Array<{ chatId: number; messageId: number }>,
  };
  let nextMessageId = 900;

  const api = {
    editMessageText: async (chatId: number, messageId: number, text: string) => {
      if (options.failEdit) throw options.failEdit;
      calls.edits.push({ chatId, messageId, text });
      return true;
    },
    sendMessage: async (chatId: number, text: string) => {
      calls.sends.push({ chatId, text });
      return { message_id: nextMessageId++ };
    },
    deleteMessage: async (chatId: number, messageId: number) => {
      calls.deletes.push({ chatId, messageId });
      return true;
    },
  } as unknown as Api;

  const notifier = new ScannerNotifier();
  notifier.init(api, async () => 'id');

  return { calls, notifier };
}

test('alert meng-edit pesan panel yang terdaftar, bukan mengirim pesan baru', async () => {
  const { calls, notifier } = setup();
  notifier.registerMessage(111, 42);

  await notifier.deliver([111], alert);

  assert.equal(calls.edits.length, 1);
  assert.equal(calls.sends.length, 0);
  assert.equal(calls.edits[0].messageId, 42);
  assert.ok(calls.edits[0].text.includes('🚨 *TOKEN BARU*'));
});

test('alert pertama tanpa panel mengirim satu pesan, alert berikutnya meng-edit pesan itu', async () => {
  const { calls, notifier } = setup();

  await notifier.deliver([111], alert);
  await notifier.deliver([111], alert);

  assert.equal(calls.sends.length, 1);
  assert.equal(calls.edits.length, 1);
  assert.equal(calls.edits[0].messageId, 900);
});

test('deleteMessage menghapus pesan notifikasi yang tersimpan', async () => {
  const { calls, notifier } = setup();
  notifier.registerMessage(111, 42);

  await notifier.deleteMessage(111);
  await notifier.deleteMessage(111);

  assert.deepEqual(calls.deletes, [{ chatId: 111, messageId: 42 }]);
});

test('error "message is not modified" diabaikan tanpa mengirim ulang', async () => {
  const error = new GrammyError(
    'Call failed!',
    { error_code: 400, description: 'Bad Request: message is not modified' },
    'editMessageText',
    {},
  );
  const { calls, notifier } = setup({ failEdit: error });
  notifier.registerMessage(111, 42);

  await notifier.deliver([111], alert);

  assert.equal(calls.sends.length, 0);
});
