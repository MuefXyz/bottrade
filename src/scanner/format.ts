import { formatUsd, tokenLabel } from '../copyTrade/format.js';
import type { ManualBuyResult } from '../copyTrade/service.js';
import { t, type Lang } from '../i18n.js';
import { escapeMarkdown } from '../utils/markdown.js';
import type { AlertToken } from './types.js';

export function formatAlert(
  token: AlertToken,
  devBuySol: number,
  marketCapUsd: number | null,
  lang: Lang,
): string {
  const name = escapeMarkdown(token.name ?? 'Unknown');
  const symbol = escapeMarkdown(token.symbol ?? '?');
  const marketCapSol = token.marketCapSol ?? 0;

  const mcap =
    marketCapUsd === null
      ? `~${marketCapSol.toFixed(1)} SOL`
      : `*$${marketCapUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}* (~${marketCapSol.toFixed(1)} SOL)`;

  return [
    t(lang, 'alertTitle'),
    '',
    `🪙 *${name}* (${symbol})`,
    `📬 CA: \`${token.mint}\``,
    `👨‍💻 Dev: \`${token.traderPublicKey}\``,
    `${t(lang, 'alertDevBuy')}: *${devBuySol.toFixed(2)} SOL*`,
    `${t(lang, 'alertMcap')}: ${mcap}`,
    '',
    `🔗 [pump.fun](https://pump.fun/coin/${token.mint}) · [solscan](https://solscan.io/token/${token.mint})`,
    '',
    t(lang, 'alertDisclaimer'),
  ].join('\n');
}

/** Hasil buy manual dari alert Scanner Token. */
export function formatBuyResult(result: ManualBuyResult, lang: Lang): string {
  if (!result.ok) {
    const lines = [t(lang, 'scanBuyFailedTitle')];

    if (result.reason === 'disabled') {
      lines.push('', t(lang, 'copyDisabled'));
    } else if (result.reason === 'exists') {
      lines.push('', t(lang, 'scanBuyDuplicate'));
    } else if (result.reason === 'max') {
      lines.push('', t(lang, 'copyErrorMaxPositions'));
    } else if (result.reason === 'no_wallet') {
      lines.push('', t(lang, 'copyErrorNoBotWallet'));
    } else {
      lines.push(
        '',
        result.message
          ? `${t(lang, 'scanBuyFailed')}: ${escapeMarkdown(result.message)}`
          : t(lang, 'scanBuyFailed'),
      );
    }

    return lines.join('\n');
  }

  const lines = [t(lang, 'scanBuyTitle')];
  if (result.dryRun) lines.push(t(lang, 'copySimulationTag'));

  lines.push(
    '',
    `${t(lang, 'copyTokenLabel')}: ${tokenLabel(result.symbol, result.mint)}`,
    `${t(lang, 'copyAmountLabel')}: *${result.amountSol} SOL*`,
  );

  if (result.priceUsd !== null) {
    lines.push(`${t(lang, 'copyEntryLabel')}: ${formatUsd(result.priceUsd)}`);
  }

  lines.push(
    '',
    result.signature
      ? `${t(lang, 'copyTxLabel')}: \`${result.signature}\``
      : t(lang, 'copyDryNoTx'),
  );

  return lines.join('\n');
}
