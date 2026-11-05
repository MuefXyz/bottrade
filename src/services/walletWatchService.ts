import { prisma } from '../db.js';
import { base58Decode } from './walletService.js';

export const MAX_WATCHED_WALLETS = 10;

export type AddWalletResult =
  | { ok: true; address: string }
  | { ok: false; reason: 'invalid' | 'limit' | 'duplicate' };

/** Alamat Solana valid = base58 yang decode-nya tepat 32 byte. */
export function isValidWalletAddress(address: string): boolean {
  try {
    return base58Decode(address).length === 32;
  } catch {
    return false;
  }
}

export async function listWatchedWallets(telegramId: string) {
  return prisma.watchedWallet.findMany({
    where: { telegramId },
    orderBy: { createdAt: 'asc' },
  });
}

/** Dipakai watcher global: semua wallet dari semua user + pemiliknya. */
export async function listAllWatchedWallets(): Promise<
  Array<{ telegramId: string; address: string }>
> {
  return prisma.watchedWallet.findMany({
    select: { telegramId: true, address: true },
  });
}

export async function addWatchedWallet(
  telegramId: string,
  rawAddress: string,
): Promise<AddWalletResult> {
  const address = rawAddress.trim();

  if (!isValidWalletAddress(address)) return { ok: false, reason: 'invalid' };

  const count = await prisma.watchedWallet.count({ where: { telegramId } });
  if (count >= MAX_WATCHED_WALLETS) return { ok: false, reason: 'limit' };

  const existing = await prisma.watchedWallet.findUnique({
    where: { telegramId_address: { telegramId, address } },
  });
  if (existing !== null) return { ok: false, reason: 'duplicate' };

  await prisma.watchedWallet.create({ data: { telegramId, address } });
  return { ok: true, address };
}

export async function removeWatchedWallet(
  telegramId: string,
  address: string,
): Promise<void> {
  await prisma.watchedWallet.deleteMany({ where: { telegramId, address } });
}
