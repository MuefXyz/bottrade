import { prisma } from '../db.js';
import type { CopyTradeDefaults } from '../copyTrade/config.js';

export interface CopyTradeSettings {
  amountSol: number;
  takeProfitPct: number;
  stopLossPct: number;
  maxPositions: number;
  maxAgeMinutes: number;
  slippagePct: number;
  priorityFeeSol: number;
}

export async function getCopyTradeSettings(
  telegramId: string,
  defaults: CopyTradeDefaults,
): Promise<CopyTradeSettings> {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: {
      copyAmountSol: true,
      copyTakeProfitPct: true,
      copyStopLossPct: true,
      copyMaxPositions: true,
      copyMaxAgeMinutes: true,
      copySlippagePct: true,
      copyPriorityFeeSol: true,
    },
  });

  return {
    amountSol: user?.copyAmountSol ?? defaults.amountSol,
    takeProfitPct: user?.copyTakeProfitPct ?? defaults.tpPct,
    stopLossPct: user?.copyStopLossPct ?? defaults.slPct,
    maxPositions: user?.copyMaxPositions ?? defaults.maxPositions,
    maxAgeMinutes: user?.copyMaxAgeMinutes ?? defaults.maxAgeMs / 60_000,
    slippagePct: user?.copySlippagePct ?? defaults.slippage,
    priorityFeeSol: user?.copyPriorityFeeSol ?? defaults.priorityFee,
  };
}

export async function setCopyTradeSetting(
  telegramId: string,
  setting: keyof CopyTradeSettings,
  value: number,
): Promise<void> {
  let data:
    | { copyAmountSol: number }
    | { copyTakeProfitPct: number }
    | { copyStopLossPct: number }
    | { copyMaxPositions: number }
    | { copyMaxAgeMinutes: number }
    | { copySlippagePct: number }
    | { copyPriorityFeeSol: number };

  switch (setting) {
    case 'amountSol':
      data = { copyAmountSol: value };
      break;
    case 'takeProfitPct':
      data = { copyTakeProfitPct: value };
      break;
    case 'stopLossPct':
      data = { copyStopLossPct: value };
      break;
    case 'maxPositions':
      data = { copyMaxPositions: value };
      break;
    case 'maxAgeMinutes':
      data = { copyMaxAgeMinutes: value };
      break;
    case 'slippagePct':
      data = { copySlippagePct: value };
      break;
    case 'priorityFeeSol':
      data = { copyPriorityFeeSol: value };
      break;
  }

  await prisma.user.update({
    where: { telegramId },
    data,
  });
}
