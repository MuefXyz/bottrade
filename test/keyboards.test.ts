import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  copyTradeInlineKeyboard,
  detailInlineKeyboard,
  mainMenuInlineKeyboard,
  mainMenuKeyboard,
  menuActionFor,
  positionsInlineKeyboard,
  privateKeyInlineKeyboard,
  scannerAlertInlineKeyboard,
  scannerBuyPromptKeyboard,
  scannerBuyResultKeyboard,
  scannerInlineKeyboard,
  settingsCancelKeyboard,
  settingsInlineKeyboard,
  walletDetailInlineKeyboard,
} from '../src/keyboards/mainMenu.js';

test('every reply keyboard label maps back to its menu action', () => {
  for (const lang of ['id', 'en'] as const) {
    const keyboard = mainMenuKeyboard(lang);
    for (const row of keyboard.keyboard) {
      for (const button of row) {
        const text = typeof button === 'string' ? button : button.text;
        assert.notEqual(menuActionFor(text), undefined, `label "${text}" tidak terpetakan`);
      }
    }
  }
});

test('all four menu actions are reachable in both languages', () => {
  const actions = new Set<string>();
  for (const lang of ['id', 'en'] as const) {
    for (const row of mainMenuKeyboard(lang).keyboard) {
      for (const button of row) {
        const text = typeof button === 'string' ? button : button.text;
        const action = menuActionFor(text);
        if (action) actions.add(action);
      }
    }
  }
  assert.deepEqual([...actions].sort(), ['help', 'language', 'main', 'wallet']);
});

test('unknown text is not treated as a menu action', () => {
  assert.equal(menuActionFor('halo dunia'), undefined);
});

test('detail inline keyboard has a back button to the main menu', () => {
  for (const lang of ['id', 'en'] as const) {
    const hasBack = detailInlineKeyboard(lang).inline_keyboard.some((row) =>
      row.some((button) => 'callback_data' in button && button.callback_data === 'menu:back'),
    );
    assert.ok(hasBack, `tombol back hilang untuk bahasa ${lang}`);
  }
});

function hasCallbackData(
  keyboard: { inline_keyboard: unknown[][] },
  data: string,
): boolean {
  return keyboard.inline_keyboard.some((row) =>
    row.some(
      (button) =>
        typeof button === 'object' &&
        button !== null &&
        'callback_data' in button &&
        (button as { callback_data?: string }).callback_data === data,
    ),
  );
}

test('wallet detail keyboard has private key and back buttons', () => {
  for (const lang of ['id', 'en'] as const) {
    assert.ok(hasCallbackData(walletDetailInlineKeyboard(lang), 'wallet:privatekey'));
    assert.ok(hasCallbackData(walletDetailInlineKeyboard(lang), 'menu:wallet'));
    assert.ok(hasCallbackData(walletDetailInlineKeyboard(lang), 'menu:back'));
  }
});

test('private key view has a back button to wallet detail', () => {
  for (const lang of ['id', 'en'] as const) {
    assert.ok(hasCallbackData(privateKeyInlineKeyboard(lang), 'menu:wallet'));
  }
});

test('main menu opens the scanner as a new panel message', () => {
  for (const lang of ['id', 'en'] as const) {
    assert.ok(hasCallbackData(mainMenuInlineKeyboard(lang), 'scan:open'));
    assert.ok(hasCallbackData(mainMenuInlineKeyboard(lang), 'copy:open'));
    assert.ok(hasCallbackData(mainMenuInlineKeyboard(lang), 'pos:open'));
    assert.ok(hasCallbackData(mainMenuInlineKeyboard(lang), 'settings:open'));
  }
});

test('scanner panel punya Start/Stop dan tombol Tutup saat berhenti', () => {
  for (const lang of ['id', 'en'] as const) {
    const running = scannerInlineKeyboard(lang, true);
    assert.ok(hasCallbackData(running, 'scan:stop'));
    assert.equal(hasCallbackData(running, 'scan:start'), false);
    assert.equal(hasCallbackData(running, 'scan:dismiss'), false);
    assert.equal(hasCallbackData(running, 'scan:panel'), false);
    assert.equal(hasCallbackData(running, 'scan:back'), false);

    const stopped = scannerInlineKeyboard(lang, false);
    assert.ok(hasCallbackData(stopped, 'scan:start'));
    assert.ok(hasCallbackData(stopped, 'scan:dismiss'));
    assert.equal(hasCallbackData(stopped, 'scan:stop'), false);
  }
});

test('scanner alert punya tombol Buy manual dan Stop', () => {
  const mint = 'So11111111111111111111111111111111111111112';
  for (const lang of ['id', 'en'] as const) {
    const alert = scannerAlertInlineKeyboard(lang, mint);
    assert.ok(hasCallbackData(alert, `scan:buy:${mint}`));
    assert.ok(hasCallbackData(alert, 'scan:stop'));

    assert.ok(hasCallbackData(scannerBuyPromptKeyboard(lang), 'scan:buy:cancel'));
    assert.ok(hasCallbackData(scannerBuyResultKeyboard(lang), 'scan:buy:dismiss'));
  }
});

test('copy-trade panel hanya berisi wallet, add, dan start/stop', () => {
  for (const lang of ['id', 'en'] as const) {
    const running = copyTradeInlineKeyboard(
      lang,
      [{ address: 'So11111111111111111111111111111111111111112' }],
      true,
    );
    assert.equal(hasCallbackData(running, 'copy:amount'), false);
    assert.equal(hasCallbackData(running, 'copy:tp'), false);
    assert.equal(hasCallbackData(running, 'copy:sl'), false);
    assert.ok(hasCallbackData(running, 'copy:add'));
    assert.ok(hasCallbackData(running, 'copy:stop'));
    assert.equal(hasCallbackData(running, 'copy:dismiss'), false);
    assert.ok(
      hasCallbackData(
        running,
        'copy:rm:So11111111111111111111111111111111111111112',
      ),
    );

    const stopped = copyTradeInlineKeyboard(lang, [], false);
    assert.ok(hasCallbackData(stopped, 'copy:start'));
    assert.ok(hasCallbackData(stopped, 'copy:dismiss'));
    assert.equal(hasCallbackData(stopped, 'copy:stop'), false);
  }
});

test('panel Pengaturan terpusat punya nominal, TP, SL, filter scanner, dan back', () => {
  for (const lang of ['id', 'en'] as const) {
    const keyboard = settingsInlineKeyboard(lang);
    assert.ok(hasCallbackData(keyboard, 'settings:amount'));
    assert.ok(hasCallbackData(keyboard, 'settings:tp'));
    assert.ok(hasCallbackData(keyboard, 'settings:sl'));
    assert.ok(hasCallbackData(keyboard, 'settings:maxpos'));
    assert.ok(hasCallbackData(keyboard, 'settings:maxage'));
    assert.ok(hasCallbackData(keyboard, 'settings:slippage'));
    assert.ok(hasCallbackData(keyboard, 'settings:fee'));
    assert.ok(hasCallbackData(keyboard, 'settings:mcap'));
    assert.ok(hasCallbackData(keyboard, 'settings:devbuy'));
    assert.ok(hasCallbackData(keyboard, 'settings:window'));
    assert.ok(hasCallbackData(keyboard, 'settings:pause'));
    assert.ok(hasCallbackData(keyboard, 'menu:back'));

    assert.ok(hasCallbackData(settingsCancelKeyboard(lang), 'settings:cancel'));
  }
});

test('panel Posisi Terbuka punya close per token dan back', () => {
  for (const lang of ['id', 'en'] as const) {
    const keyboard = positionsInlineKeyboard(lang, [
      { id: 3, symbol: 'TEST', mint: 'So11111111111111111111111111111111111111112' },
    ]);

    assert.ok(hasCallbackData(keyboard, 'pos:close:3'));
    assert.equal(hasCallbackData(keyboard, 'pos:refresh'), false);
    assert.ok(hasCallbackData(keyboard, 'menu:back'));
  }
});
