import { env } from '../config.js';

/**
 * Ubah ADMIN_ID menjadi URL tombol Telegram.
 * Menerima ID numerik (`8121584526`), username (`@nama` atau `nama`),
 * atau URL `t.me` / `tg://` yang sudah lengkap.
 */
export function adminChatUrl(
  adminId: string | undefined = env.ADMIN_ID,
): string | null {
  const value = adminId?.trim();
  if (!value) return null;

  if (value.startsWith('tg://')) return value;

  if (value.startsWith('https://t.me/')) return value;
  if (value.startsWith('t.me/')) return `https://${value}`;

  const username = value.startsWith('@') ? value.slice(1) : value;
  if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) {
    return `https://t.me/${username}`;
  }

  if (/^\d{5,}$/.test(value)) return `tg://user?id=${value}`;

  return null;
}
