import { t, type Lang } from '../i18n.js';
import { escapeMarkdown } from '../utils/markdown.js';
import type { CopyNotice, CopyPositionView } from './types.js';

function shortAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function formatUsd(price: number | null): string {
  if (price === null) return '?';
  if (price < 0.01) return `$${price.toPrecision(4)}`;
  return `$${price.toLocaleString('en-US', { maximumFractionDigits: 6 })}`;
}

function formatPnl(pnlPct: number | null): string {
  if (pnlPct === null) return '?';
  const sign = pnlPct >= 0 ? '+' : '';
  return `${sign}${pnlPct.toFixed(2)}%`;
}

function pnlEmoji(pnlPct: number | null): string {
  if (pnlPct === null) return '⚪';
  return pnlPct >= 0 ? '🟢' : '🔴';
}

export function tokenLabel(symbol: string | null, mint: string): string {
  const name = symbol ? escapeMarkdown(symbol) : t('en', 'copyUnknown');
  return `*${name}* (\`${mint}\`)`;
}

function tokenName(symbol: string | null): string {
  return symbol ? escapeMarkdown(symbol) : t('en', 'copyUnknown');
}

function reasonLabel(lang: Lang, reason: 'tp' | 'sl' | 'age' | 'manual'): string {
  if (reason === 'tp') return t(lang, 'copyReasonTp');
  if (reason === 'sl') return t(lang, 'copyReasonSl');
  if (reason === 'manual') return t(lang, 'copyReasonManual');
  return t(lang, 'copyReasonAge');
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatEvent(notice: CopyNotice, lang: Lang): string {
  if (notice.kind === 'error') {
    return `⚠️ ${escapeMarkdown(notice.message)}`;
  }

  if (notice.kind === 'buy') {
    return (
      `🟢 ${t(lang, 'copyBoardBuyEvent')}: *${tokenName(notice.symbol)}*` +
      ` · ${notice.amountSol} SOL`
    );
  }

  return (
    `🔴 ${t(lang, 'copyBoardSellEvent')}: *${tokenName(notice.symbol)}*` +
    ` · ${formatPnl(notice.pnlPct)} (${reasonLabel(lang, notice.reason)})`
  );
}

export function formatNotice(notice: CopyNotice, lang: Lang): string {
  if (notice.kind === 'error') {
    const lines = [t(lang, 'copyNoticeErrorTitle')];
    if (notice.mint !== null) lines.push(`\`${notice.mint}\``);
    lines.push('', escapeMarkdown(notice.message));
    return lines.join('\n');
  }

  const simulation = notice.dryRun ? t(lang, 'copySimulationTag') : null;

  if (notice.kind === 'buy') {
    const lines = [t(lang, 'copyNoticeBuyTitle')];
    if (simulation) lines.push(simulation);

    lines.push(
      '',
      `${t(lang, 'copyTokenLabel')}: ${tokenLabel(notice.symbol, notice.mint)}`,
      `${t(lang, 'copySourceLabel')}: \`${shortAddress(notice.sourceWallet)}\``,
      `${t(lang, 'copyAmountLabel')}: *${notice.amountSol} SOL*`,
    );

    if (notice.priceUsd !== null) {
      lines.push(`${t(lang, 'copyEntryLabel')}: ${formatUsd(notice.priceUsd)}`);
    }

    lines.push(
      '',
      notice.signature
        ? `${t(lang, 'copyTxLabel')}: \`${notice.signature}\``
        : t(lang, 'copyDryNoTx'),
    );

    return lines.join('\n');
  }

  const lines = [t(lang, 'copyNoticeSellTitle')];
  if (simulation) lines.push(simulation);

  lines.push(
    '',
    `${t(lang, 'copyTokenLabel')}: ${tokenLabel(notice.symbol, notice.mint)}`,
    `${t(lang, 'copyReasonLabel')}: ${reasonLabel(lang, notice.reason)}`,
    `${t(lang, 'copyPnlLabel')}: *${formatPnl(notice.pnlPct)}*`,
  );

  if (notice.closePriceUsd !== null) {
    lines.push(`${t(lang, 'copyExitLabel')}: ${formatUsd(notice.closePriceUsd)}`);
  }

  lines.push(
    '',
    notice.signature
      ? `${t(lang, 'copyTxLabel')}: \`${notice.signature}\``
      : t(lang, 'copyDryNoTx'),
  );

  return lines.join('\n');
}

export interface PositionBoardOptions {
  notice?: CopyNotice;
  updatedAt?: number;
  /** Judul kustom, mis. panel Posisi Terbuka dari menu utama. */
  title?: string;
}

/**
 * Board live berisi semua posisi terbuka + PnL terkini.
 * Tiap posisi mendapat tombol close sendiri di keyboard-nya.
 */
export function formatPositionBoard(
  positions: CopyPositionView[],
  lang: Lang,
  options: PositionBoardOptions = {},
): string {
  const { notice, updatedAt = Date.now(), title = t(lang, 'copyBoardTitle') } =
    options;
  const dryRun =
    positions.some((position) => position.dryRun) ||
    (notice !== undefined && notice.kind !== 'error' && notice.dryRun);

  const lines = [title];
  if (dryRun) lines.push(t(lang, 'copySimulationTag'));
  lines.push('');

  if (positions.length === 0) {
    lines.push(t(lang, 'copyBoardEmpty'));
  } else {
    positions.forEach((position, index) => {
      if (index > 0) lines.push('');
      lines.push(tokenLabel(position.symbol, position.mint));
      lines.push(`${t(lang, 'copyAmountLabel')}: ${position.amountSol} SOL`);
      lines.push(
        `${t(lang, 'copyEntryLabel')}: ${formatUsd(position.entryPriceUsd)}`,
      );
      lines.push(
        `${t(lang, 'copyCurrentLabel')}: ${
          position.currentPriceUsd === null
            ? t(lang, 'copyPricePending')
            : formatUsd(position.currentPriceUsd)
        }`,
      );
      lines.push(
        `${t(lang, 'copyPnlLabel')}: ${pnlEmoji(position.pnlPct)} ` +
          `*${formatPnl(position.pnlPct)}*`,
      );
    });
  }

  if (notice !== undefined) {
    lines.push('', formatEvent(notice, lang));
  }

  lines.push(
    '',
    t(lang, 'copyBoardUpdated').replace('{time}', formatTime(updatedAt)),
  );

  return lines.join('\n');
}

