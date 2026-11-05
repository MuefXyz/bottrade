import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  base58Decode,
  base58Encode,
  decrypt,
  generateWallet,
  privateKeyFromEncrypted,
} from '../src/services/walletService.js';
import { isValidWalletAddress } from '../src/services/walletWatchService.js';

test('base58Encode encodes 32 zero bytes as 32 ones', () => {
  assert.equal(base58Encode(Buffer.alloc(32)), '1'.repeat(32));
});

test('base58Encode encodes empty buffer as empty string', () => {
  assert.equal(base58Encode(Buffer.alloc(0)), '');
});

test('generateWallet produces a solana-shaped address and 64-byte secret', () => {
  const wallet = generateWallet();

  assert.ok(wallet.publicKey.length >= 32 && wallet.publicKey.length <= 44);
  assert.ok(wallet.privateKey.length >= 80);
  assert.equal(decrypt(wallet.encryptedPrivateKey).length, 64);
});

test('privateKeyFromEncrypted returns the original private key', () => {
  const wallet = generateWallet();
  assert.equal(privateKeyFromEncrypted(wallet.encryptedPrivateKey), wallet.privateKey);
});

test('base58Decode membalik base58Encode', () => {
  const buffer = Buffer.from(
    '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
    'hex',
  );
  assert.deepEqual(base58Decode(base58Encode(buffer)), buffer);

  const wallet = generateWallet();
  assert.equal(base58Decode(wallet.publicKey).length, 32);
  assert.equal(base58Decode(wallet.privateKey).length, 64);

  // Byte pertama 0x01 membuat hex BigInt ganjil — dulu bikin hasil 31 byte.
  const leadingNibble = Buffer.concat([Buffer.from([0x01]), Buffer.alloc(31)]);
  assert.deepEqual(base58Decode(base58Encode(leadingNibble)), leadingNibble);
});

test('isValidWalletAddress menolak alamat yang bukan 32 byte base58', () => {
  const wallet = generateWallet();

  assert.equal(isValidWalletAddress(wallet.publicKey), true);
  assert.equal(isValidWalletAddress('bukan-alamat-solana'), false);
  assert.equal(isValidWalletAddress('1111'), false);
  assert.equal(isValidWalletAddress(''), false);
});
