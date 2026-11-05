import { Keypair } from '@solana/web3.js';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { env } from '../config.js';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_DIGITS = new Map(
  [...BASE58_ALPHABET].map((char, index) => [char, BigInt(index)]),
);
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface GeneratedWallet {
  publicKey: string;
  privateKey: string;
  encryptedPrivateKey: string;
}

export function base58Encode(buffer: Buffer): string {
  if (buffer.length === 0) return '';

  let zeros = 0;
  while (zeros < buffer.length && buffer[zeros] === 0) zeros += 1;

  let value = BigInt(`0x${buffer.toString('hex')}`);
  let encoded = '';
  const radix = BigInt(58);

  while (value > 0n) {
    const remainder = Number(value % radix);
    encoded = BASE58_ALPHABET[remainder] + encoded;
    value /= radix;
  }

  return '1'.repeat(zeros) + encoded;
}

export function base58Decode(value: string): Buffer {
  if (value.length === 0) return Buffer.alloc(0);

  let zeros = 0;
  while (zeros < value.length && value[zeros] === '1') zeros += 1;

  let number = 0n;
  for (const char of value) {
    const digit = BASE58_DIGITS.get(char);
    if (digit === undefined) throw new Error(`Karakter base58 tidak valid: ${char}`);
    number = number * 58n + digit;
  }

  const hex = number === 0n ? '' : number.toString(16);
  const body =
    hex.length === 0
      ? Buffer.alloc(0)
      : Buffer.from(hex.length % 2 === 1 ? `0${hex}` : hex, 'hex');

  return Buffer.concat([Buffer.alloc(zeros), body]);
}

export function generateWallet(): GeneratedWallet {
  const keypair = Keypair.generate();
  const secretKey = Buffer.from(keypair.secretKey);
  const publicKey = base58Encode(Buffer.from(keypair.publicKey.toBytes()));

  return {
    publicKey,
    privateKey: base58Encode(secretKey),
    encryptedPrivateKey: encrypt(secretKey),
  };
}

export function privateKeyFromEncrypted(encryptedPrivateKey: string): string {
  return base58Encode(decrypt(encryptedPrivateKey));
}

function deriveKey(salt: Buffer): Buffer {
  return scryptSync(env.WALLET_ENCRYPTION_KEY, salt, 32);
}

function encrypt(plain: Buffer): string {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(salt), iv);

  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, ciphertext]).toString('base64');
}

export function decrypt(encoded: string): Buffer {
  const payload = Buffer.from(encoded, 'base64');
  const salt = payload.subarray(0, SALT_BYTES);
  const iv = payload.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const tag = payload.subarray(SALT_BYTES + IV_BYTES, SALT_BYTES + IV_BYTES + TAG_BYTES);
  const ciphertext = payload.subarray(SALT_BYTES + IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', deriveKey(salt), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
