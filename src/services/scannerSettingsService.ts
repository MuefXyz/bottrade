import { prisma } from '../db.js';
import type { ScannerConfig } from '../scanner/config.js';

export interface ScannerSettings {
  minMarketCapUsd: number;
  minDevBuySol: number;
  windowMinutes: number;
  pauseMinutes: number;
}

export async function getScannerSettings(
  telegramId: string,
  defaults: Pick<
    ScannerConfig,
    'minMarketCapUsd' | 'devBuyMinSol' | 'devBuyWindowMs' | 'pauseMs'
  >,
): Promise<ScannerSettings> {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: {
      scanMinMarketCapUsd: true,
      scanMinDevBuySol: true,
      scanWindowMinutes: true,
      scanPauseMinutes: true,
    },
  });

  return {
    minMarketCapUsd: user?.scanMinMarketCapUsd ?? defaults.minMarketCapUsd,
    minDevBuySol: user?.scanMinDevBuySol ?? defaults.devBuyMinSol,
    windowMinutes: user?.scanWindowMinutes ?? defaults.devBuyWindowMs / 60_000,
    pauseMinutes: user?.scanPauseMinutes ?? defaults.pauseMs / 60_000,
  };
}

export async function setScannerSetting(
  telegramId: string,
  setting: keyof ScannerSettings,
  value: number,
): Promise<void> {
  const data =
    setting === 'minMarketCapUsd'
      ? { scanMinMarketCapUsd: value }
      : setting === 'minDevBuySol'
        ? { scanMinDevBuySol: value }
        : setting === 'windowMinutes'
          ? { scanWindowMinutes: value }
          : { scanPauseMinutes: value };

  await prisma.user.update({
    where: { telegramId },
    data,
  });
}
