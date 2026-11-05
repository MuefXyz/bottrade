import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCopyTradeConfig,
  resolvePollMs,
  resolveRpcUrl,
} from '../src/copyTrade/config.js';
import type { Env } from '../src/config.js';

test('resolveRpcUrl memprioritaskan override Helius, lalu API key, lalu RPC biasa', () => {
  assert.equal(
    resolveRpcUrl({
      heliusRpcUrl: 'https://custom.example/rpc',
      heliusApiKey: 'key',
      solanaRpcUrl: 'https://public.example',
    }),
    'https://custom.example/rpc',
  );

  assert.equal(
    resolveRpcUrl({
      heliusApiKey: 'key',
      solanaRpcUrl: 'https://public.example',
    }),
    'https://mainnet.helius-rpc.com/?api-key=key',
  );

  assert.equal(
    resolveRpcUrl({ solanaRpcUrl: 'https://public.example' }),
    'https://public.example',
  );
});

test('resolvePollMs menjaga interval minimal agar RPC publik tidak dibanjiri', () => {
  assert.equal(resolvePollMs('rpc', 500, false), 2_000);
  assert.equal(resolvePollMs('auto', 3_000, false), 3_000);
  assert.equal(resolvePollMs('helius', 800, true), 1_000);
});

test('buildCopyTradeConfig memakai default kode untuk pengaturan per user', () => {
  const source = {
    COPY_TRADE_ENABLED: 'true',
    COPY_TRADE_DRY_RUN: 'false',
    COPY_TRADE_POOL: 'auto',
    COPY_TRADE_PROVIDER: 'auto',
    COPY_TRADE_RPC_POLL_MS: 3_000,
    COPY_TRADE_POLL_SECONDS: 10,
    HELIUS_API_KEY: '',
    HELIUS_RPC_URL: undefined,
    SOLANA_RPC_URL: 'https://public.example',
  } as unknown as Env;

  const config = buildCopyTradeConfig(source);

  assert.equal(config.enabled, true);
  assert.equal(config.dryRun, false);
  assert.equal(config.amountSol, 0.01);
  assert.equal(config.tpPct, 150);
  assert.equal(config.slPct, 0);
  assert.equal(config.maxAgeMs, 0);
  assert.equal(config.slippage, 15);
  assert.equal(config.priorityFee, 0.0001);
  assert.equal(config.monitorMs, 10_000);
  assert.equal(config.maxPositions, 5);
  assert.equal(config.rpcUrl, 'https://public.example');
  assert.equal(config.heliusApiKey, null);
});
