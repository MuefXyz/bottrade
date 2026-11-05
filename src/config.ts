import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const booleanSchema = z.enum(['true', 'false']);

/** Nama bot yang tampil di pesan. Bukan rahasia, jadi cukup konstanta. */
export const BOT_NAME = 'PumpHunter Wallet Bot';

/** Parse mode Telegram default untuk seluruh pesan bot. */
const TELEGRAM_PARSE_MODE = 'Markdown';

export const envSchema = z.object({
  // === Wajib ===
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN wajib diisi'),
  WALLET_ENCRYPTION_KEY: z.string().min(1, 'WALLET_ENCRYPTION_KEY wajib diisi'),
  DATABASE_URL: z.string().default('file:./dev.db'),

  // === Opsional (default dipakai kalo kosong) ===
  SOLANA_RPC_URL: z.string().default('https://api.mainnet-beta.solana.com'),
  // ID Telegram admin (angka) atau username (@nama) untuk tombol Bantuan.
  ADMIN_ID: z.string().trim().optional(),

  // === Scanner token baru (PumpPortal) ===
  SCANNER_ENABLED: booleanSchema.default('true'),
  SCANNER_AUTOSTART: booleanSchema.default('false'),
  PUMPPORTAL_API_KEY: z.string().optional(),

  // === Copy-trade / Scan Wallet ===
  COPY_TRADE_PROVIDER: z
    .enum(['auto', 'pumpportal', 'helius', 'rpc'])
    .default('auto'),
  COPY_TRADE_RPC_POLL_MS: z.coerce.number().int().positive().default(3000),
  HELIUS_API_KEY: z.string().optional(),
  HELIUS_RPC_URL: z.string().optional(),
  HELIUS_WSS_URL: z.string().optional(),
  COPY_TRADE_ENABLED: booleanSchema.default('true'),
  COPY_TRADE_DRY_RUN: booleanSchema.default('true'),
  COPY_TRADE_POOL: z.string().default('auto'),
  COPY_TRADE_POLL_SECONDS: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

export function parseMode(): 'Markdown' | 'HTML' | undefined {
  return TELEGRAM_PARSE_MODE;
}
