/**
 * Escape karakter spesial Markdown (legacy) agar entity tidak rusak.
 * Dipakai untuk nilai dinamis seperti username, nama token, dsb.
 */
export function escapeMarkdown(value: string): string {
  return value.replace(/([_*`[\]])/g, '\\$1');
}
