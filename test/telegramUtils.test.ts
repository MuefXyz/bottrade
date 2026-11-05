import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GrammyError } from 'grammy';
import { isMessageNotModified, safeAnswerCallbackQuery } from '../src/utils/telegram.js';

function grammyError(description: string): GrammyError {
  return new GrammyError(
    'Call failed!',
    { error_code: 400, description },
    'editMessageText',
    {},
  );
}

test('isMessageNotModified mengenali error "message is not modified" dari Telegram', () => {
  assert.equal(
    isMessageNotModified(
      grammyError(
        'Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message',
      ),
    ),
    true,
  );
});

test('isMessageNotModified tidak menelan error Telegram lain', () => {
  assert.equal(isMessageNotModified(grammyError('Bad Request: chat not found')), false);
  assert.equal(isMessageNotModified(new Error('message is not modified')), false);
  assert.equal(isMessageNotModified(null), false);
});

type AnswerCtx = Parameters<typeof safeAnswerCallbackQuery>[0];

function answerCtx(error: Error | null): AnswerCtx {
  return {
    answerCallbackQuery: async () => {
      if (error) throw error;
      return true;
    },
  } as unknown as AnswerCtx;
}

test('safeAnswerCallbackQuery mengabaikan callback yang sudah kedaluwarsa', async () => {
  await safeAnswerCallbackQuery(
    answerCtx(
      grammyError(
        'Bad Request: query is too old and response timeout expired or query ID is invalid',
      ),
    ),
  );
});

test('safeAnswerCallbackQuery tidak menelan error callback lain', async () => {
  await assert.rejects(
    () => safeAnswerCallbackQuery(answerCtx(grammyError('Bad Request: chat not found'))),
    /chat not found/,
  );
});
