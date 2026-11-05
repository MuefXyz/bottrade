import { InlineKeyboard, Keyboard } from 'grammy';
import { t, type Lang } from '../i18n.js';

export type MenuAction = 'wallet' | 'main' | 'help' | 'language';

const ACTION_LABEL_KEYS = [
  ['wallet', 'menuWalletButton'],
  ['main', 'menuMainButton'],
  ['help', 'menuHelpButton'],
  ['language', 'menuLanguageButton'],
] as const;

export function mainMenuKeyboard(lang: Lang): Keyboard {
  return new Keyboard()
    .text(t(lang, 'menuWalletButton'))
    .text(t(lang, 'menuMainButton'))
    .row()
    .text(t(lang, 'menuHelpButton'))
    .text(t(lang, 'menuLanguageButton'))
    .resized()
    .placeholder(t(lang, 'menuPlaceholder'));
}

export function menuActionFor(text: string): MenuAction | undefined {
  for (const [action, key] of ACTION_LABEL_KEYS) {
    if (text === t('id', key) || text === t('en', key)) return action;
  }
  return undefined;
}

export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🇮🇩 Indonesia', 'lang:id').text('🇬🇧 English', 'lang:en');
}

export function walletConfirmKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'createAnyway'), 'wallet:confirm')
    .text(t(lang, 'cancel'), 'wallet:cancel');
}

export function mainMenuInlineKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'profileButton'), 'menu:profile')
    .text(t(lang, 'walletDetailButton'), 'menu:wallet')
    .row()
    .text(t(lang, 'scanButton'), 'scan:open')
    .row()
    .text(t(lang, 'copyButton'), 'copy:open')
    .row()
    .text(t(lang, 'positionsButton'), 'pos:open')
    .row()
    .text(t(lang, 'settingsButton'), 'settings:open');
}

export function shortWalletAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function copyTradeInlineKeyboard(
  lang: Lang,
  wallets: Array<{ address: string }>,
  running: boolean,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const wallet of wallets) {
    keyboard
      .text(
        `${t(lang, 'copyRemoveButton')} ${shortWalletAddress(wallet.address)}`,
        `copy:rm:${wallet.address}`,
      )
      .row();
  }

  keyboard.text(t(lang, 'copyAddButton'), 'copy:add').row();

  if (running) {
    keyboard.text(t(lang, 'copyStopButton'), 'copy:stop');
  } else {
    keyboard.text(t(lang, 'copyStartButton'), 'copy:start').row();
    // Tutup panel tanpa memulai scan.
    keyboard.text(t(lang, 'copyClosePanelButton'), 'copy:dismiss');
  }

  return keyboard;
}

export function copyTradeAddKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard().text(t(lang, 'cancel'), 'copy:cancel');
}

/** Satu tombol close untuk setiap posisi terbuka, cocok dengan board live. */
export function copyTradeBoardKeyboard(
  lang: Lang,
  positions: Array<{ id: number; symbol: string | null; mint: string }>,
  closePrefix = 'copy:close:',
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const position of positions) {
    const name = position.symbol
      ? position.symbol.slice(0, 16)
      : shortWalletAddress(position.mint);
    keyboard.text(`${t(lang, 'copyCloseButton')} ${name}`, `${closePrefix}${position.id}`).row();
  }

  return keyboard;
}

/** Panel Posisi Terbuka dari menu utama: close per token dan back. */
export function positionsInlineKeyboard(
  lang: Lang,
  positions: Array<{ id: number; symbol: string | null; mint: string }>,
): InlineKeyboard {
  const keyboard = copyTradeBoardKeyboard(lang, positions, 'pos:close:');
  keyboard.text(t(lang, 'backButton'), 'menu:back');
  return keyboard;
}

/** Panel pengaturan terpusat: copy-trade + filter scanner. */
export function settingsInlineKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'settingsAmountButton'), 'settings:amount')
    .row()
    .text(t(lang, 'settingsTpButton'), 'settings:tp')
    .text(t(lang, 'settingsSlButton'), 'settings:sl')
    .row()
    .text(t(lang, 'settingsMaxPositionsButton'), 'settings:maxpos')
    .text(t(lang, 'settingsMaxAgeButton'), 'settings:maxage')
    .row()
    .text(t(lang, 'settingsSlippageButton'), 'settings:slippage')
    .text(t(lang, 'settingsPriorityFeeButton'), 'settings:fee')
    .row()
    .text(t(lang, 'settingsMinMcapButton'), 'settings:mcap')
    .row()
    .text(t(lang, 'settingsMinDevBuyButton'), 'settings:devbuy')
    .text(t(lang, 'settingsWindowButton'), 'settings:window')
    .row()
    .text(t(lang, 'settingsPauseButton'), 'settings:pause')
    .row()
    .text(t(lang, 'backButton'), 'menu:back');
}

export function settingsCancelKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard().text(t(lang, 'cancel'), 'settings:cancel');
}

/** Tombol menuju chat admin; kosong bila ADMIN_ID belum diisi. */
export function helpInlineKeyboard(
  lang: Lang,
  adminUrl: string | null,
): InlineKeyboard | undefined {
  if (adminUrl === null) return undefined;

  return new InlineKeyboard().url(t(lang, 'helpAdminButton'), adminUrl);
}

export function scannerInlineKeyboard(lang: Lang, running: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (running) {
    keyboard.text(t(lang, 'scanStopButton'), 'scan:stop');
  } else {
    keyboard.text(t(lang, 'scanStartButton'), 'scan:start').row();
    // Tutup panel tanpa memulai scan.
    keyboard.text(t(lang, 'scanCloseButton'), 'scan:dismiss');
  }

  return keyboard;
}

/** Keyboard pada alert token: buy manual + stop scanner. */
export function scannerAlertInlineKeyboard(lang: Lang, mint: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'scanBuyButton'), `scan:buy:${mint}`)
    .row()
    .text(t(lang, 'scanStopButton'), 'scan:stop');
}

export function scannerBuyPromptKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard().text(t(lang, 'cancel'), 'scan:buy:cancel');
}

export function scannerBuyResultKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard().text(
    t(lang, 'copyClosePanelButton'),
    'scan:buy:dismiss',
  );
}

export function detailInlineKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard().text(t(lang, 'backButton'), 'menu:back');
}

export function walletDetailInlineKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'walletRefreshButton'), 'menu:wallet')
    .row()
    .text(t(lang, 'privateKeyButton'), 'wallet:privatekey')
    .row()
    .text(t(lang, 'backButton'), 'menu:back');
}

export function privateKeyInlineKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard().text(t(lang, 'backButton'), 'menu:wallet');
}
