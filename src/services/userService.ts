import { prisma } from '../db.js';
import { normalizeLang, type Lang } from '../i18n.js';

export async function getOrCreateUser(telegramId: string, username?: string) {
  return prisma.user.upsert({
    where: { telegramId },
    update: username ? { username } : {},
    create: { telegramId, username },
  });
}

export async function setUserLanguage(telegramId: string, language: Lang) {
  return prisma.user.update({
    where: { telegramId },
    data: { language },
  });
}

export async function saveWelcomeMessage(telegramId: string, messageId: number) {
  return prisma.user.update({
    where: { telegramId },
    data: { welcomeMessageId: messageId },
  });
}

export async function getUserLanguage(telegramId: string): Promise<Lang> {
  const user = await getOrCreateUser(telegramId);
  return normalizeLang(user.language);
}

export async function saveUserWallet(
  telegramId: string,
  publicKey: string,
  encryptedPrivateKey: string,
) {
  return prisma.user.update({
    where: { telegramId },
    data: { walletAddress: publicKey, encryptedPrivateKey },
  });
}

export async function clearUserWallet(telegramId: string) {
  return prisma.user.update({
    where: { telegramId },
    data: { walletAddress: null, encryptedPrivateKey: null },
  });
}

export async function getUserWallet(telegramId: string) {
  return prisma.user.findUnique({
    where: { telegramId },
    select: { walletAddress: true, encryptedPrivateKey: true },
  });
}
