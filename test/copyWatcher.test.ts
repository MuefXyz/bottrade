import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey, type Connection } from '@solana/web3.js';
import type { ParsedTransactionLike } from '../src/copyTrade/detect.js';
import { WalletWatcher } from '../src/copyTrade/watcher.js';

test('watcher retries failed transaction processing without skipping backlog', async () => {
  const owner = Keypair.generate().publicKey.toBase58();
  const signatures = Array.from({ length: 30 }, (_, index) =>
    `sig-${String(index + 1).padStart(3, '0')}`,
  );
  const parsedAttempts = new Map<string, number>();
  const handled: string[] = [];

  const connection = {
    getSlot: async () => 100,
    getSignaturesForAddress: async (
      _address: PublicKey,
      options: { limit: number; before?: string; until?: string },
    ) => {
      if (options.limit === 1) {
        return [{ signature: 'sig-000', slot: 100, err: null }];
      }

      let page = ['sig-000', ...signatures].reverse();
      if (options.before !== undefined) {
        page = page.slice(0, page.indexOf(options.before));
      }
      if (options.until !== undefined) {
        page = page.slice(0, page.indexOf(options.until));
      }
      return page.slice(0, options.limit).map((signature) => ({
        signature,
        slot: 100 + Number(signature.slice(-3)),
        err: null,
      }));
    },
    getParsedTransaction: async (signature: string): Promise<unknown> => {
      const attempts = (parsedAttempts.get(signature) ?? 0) + 1;
      parsedAttempts.set(signature, attempts);
      if (signature === 'sig-005' && attempts === 1) {
        throw new Error('temporary RPC failure');
      }

      const tokenBalance = {
        accountIndex: 1,
        mint: `mint-${signature}`,
        owner,
        uiTokenAmount: { uiAmount: 1, decimals: 0, amount: '1' },
      };
      const transaction: ParsedTransactionLike = {
        transaction: { message: { accountKeys: [owner, 'token-account'] } },
        meta: {
          err: null,
          fee: 5_000,
          preBalances: [1_000_000_000, 0],
          postBalances: [899_995_000, 0],
          preTokenBalances: [],
          postTokenBalances: [tokenBalance],
        },
      };
      return transaction;
    },
  } as unknown as Connection;

  let watcher: WalletWatcher;
  watcher = new WalletWatcher(
    connection,
    async () => [{ telegramId: '123', address: owner }],
    async (_telegramId, _sourceWallet, buy) => {
      handled.push(buy.mint);
      if (handled.length === signatures.length) watcher.stop();
    },
    5,
  );

  try {
    await watcher.start();
    await new Promise<void>((resolve) => {
      const check = () => {
        if (handled.length === signatures.length) resolve();
        else setTimeout(check, 5);
      };
      check();
    });

    assert.equal(handled.length, signatures.length);
    assert.equal(parsedAttempts.get('sig-005'), 2);
    assert.equal(parsedAttempts.get('sig-001'), 1);
    assert.equal(parsedAttempts.get('sig-030'), 1);
  } finally {
    watcher.stop();
  }
});
