import { prisma } from '../db.js';

export interface OpenPositionInput {
  telegramId: string;
  mint: string;
  symbol: string | null;
  sourceWallet: string;
  amountSol: number;
  entryPriceUsd: number | null;
  takeProfitPct: number;
  stopLossPct: number;
  txSignature: string | null;
  dryRun: boolean;
}

export interface ClosePositionInput {
  reason: 'tp' | 'sl' | 'age' | 'manual';
  closePriceUsd: number | null;
  pnlPct: number | null;
  closeSignature: string | null;
}

export async function countOpenPositions(telegramId: string): Promise<number> {
  return prisma.copyPosition.count({ where: { telegramId, status: 'open' } });
}

export async function hasOpenPosition(
  telegramId: string,
  mint: string,
): Promise<boolean> {
  const position = await prisma.copyPosition.findFirst({
    where: { telegramId, mint, status: 'open' },
    select: { id: true },
  });
  return position !== null;
}

export async function createOpenPosition(input: OpenPositionInput) {
  return prisma.copyPosition.create({
    data: {
      telegramId: input.telegramId,
      mint: input.mint,
      symbol: input.symbol,
      sourceWallet: input.sourceWallet,
      amountSol: input.amountSol,
      entryPriceUsd: input.entryPriceUsd,
      takeProfitPct: input.takeProfitPct,
      stopLossPct: input.stopLossPct,
      txSignature: input.txSignature,
      dryRun: input.dryRun,
      status: 'open',
    },
  });
}

export async function listOpenPositions(telegramId: string) {
  return prisma.copyPosition.findMany({
    where: { telegramId, status: 'open' },
    orderBy: { openedAt: 'asc' },
  });
}

/** Posisi terbuka milik user tertentu — dipakai untuk validasi tombol close. */
export async function findOpenPosition(id: number, telegramId: string) {
  return prisma.copyPosition.findFirst({
    where: { id, telegramId, status: 'open' },
  });
}

export async function listAllOpenPositions() {
  return prisma.copyPosition.findMany({
    where: { status: 'open' },
    orderBy: { openedAt: 'asc' },
  });
}

export async function setPositionEntryPrice(
  id: number,
  entryPriceUsd: number,
): Promise<void> {
  await prisma.copyPosition.update({
    where: { id },
    data: { entryPriceUsd },
  });
}

export async function closePosition(
  id: number,
  input: ClosePositionInput,
): Promise<void> {
  await prisma.copyPosition.update({
    where: { id },
    data: {
      status: 'closed',
      closeReason: input.reason,
      closeSignature: input.closeSignature,
      closePriceUsd: input.closePriceUsd,
      pnlPct: input.pnlPct,
      closedAt: new Date(),
    },
  });
}
