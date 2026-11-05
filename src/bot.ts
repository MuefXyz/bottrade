import { Bot } from 'grammy';
import { env } from './config.js';
import { copyTrade } from './copyTrade/index.js';
import { copyTradeNotifier } from './copyTrade/notifier.js';
import {
  copyTradeAddHandler,
  copyTradeCancelHandler,
  copyTradeCloseHandler,
  copyTradeDismissHandler,
  copyTradeOpenHandler,
  copyTradeRemoveHandler,
  copyTradeStartHandler,
  copyTradeStopHandler,
  copyTradeTextHandler,
} from './handlers/copyTrade.js';
import { helpCommand } from './handlers/help.js';
import { languageCallback } from './handlers/language.js';
import {
  mainMenuHandler,
  menuTextHandler,
  profileHandler,
  walletDetailHandler,
} from './handlers/menu.js';
import { positionsHandler } from './handlers/positions.js';
import {
  scannerDismissHandler,
  scannerOpenHandler,
  scannerStartHandler,
  scannerStopHandler,
} from './handlers/scanner.js';
import {
  scannerBuyHandler,
  scannerBuyTextHandler,
} from './handlers/scannerBuy.js';
import {
  settingsCancelHandler,
  settingsLegacyRedirectHandler,
  settingsOpenHandler,
  settingsSetAmountHandler,
  settingsSetDevBuyHandler,
  settingsSetFeeHandler,
  settingsSetMaxAgeHandler,
  settingsSetMaxPositionsHandler,
  settingsSetMcapHandler,
  settingsSetPauseHandler,
  settingsSetSlHandler,
  settingsSetSlippageHandler,
  settingsSetTpHandler,
  settingsSetWindowHandler,
  settingsTextHandler,
} from './handlers/settings.js';
import { startCommand } from './handlers/start.js';
import {
  walletCancelHandler,
  walletConfirmHandler,
  walletCreateHandler,
  walletPrivateKeyHandler,
} from './handlers/wallet.js';
import { scanner } from './scanner/index.js';
import { scannerNotifier } from './scanner/notifier.js';
import { getUserLanguage } from './services/userService.js';
import { menuActionFor } from './keyboards/mainMenu.js';

export const bot = new Bot(env.BOT_TOKEN);

bot.catch((error) => {
  console.error('❌ Bot error:', error.error);
});

bot.command('start', startCommand);
bot.command('help', helpCommand);

bot.callbackQuery('lang:id', languageCallback);
bot.callbackQuery('lang:en', languageCallback);

bot.callbackQuery('wallet:create', walletCreateHandler);
bot.callbackQuery('wallet:confirm', walletConfirmHandler);
bot.callbackQuery('wallet:cancel', walletCancelHandler);
bot.callbackQuery('wallet:privatekey', walletPrivateKeyHandler);

bot.callbackQuery('menu:profile', profileHandler);
bot.callbackQuery('menu:wallet', walletDetailHandler);
bot.callbackQuery('menu:back', mainMenuHandler);
bot.callbackQuery('scan:open', scannerOpenHandler);
bot.callbackQuery('scan:start', scannerStartHandler);
bot.callbackQuery('scan:stop', scannerStopHandler);
bot.callbackQuery('scan:dismiss', scannerDismissHandler);
bot.callbackQuery(/^scan:buy:/, scannerBuyHandler);

bot.callbackQuery('copy:open', copyTradeOpenHandler);
bot.callbackQuery('copy:add', copyTradeAddHandler);
bot.callbackQuery('copy:cancel', copyTradeCancelHandler);
bot.callbackQuery('copy:start', copyTradeStartHandler);
bot.callbackQuery('copy:stop', copyTradeStopHandler);
bot.callbackQuery('copy:dismiss', copyTradeDismissHandler);
bot.callbackQuery(/^copy:rm:/, copyTradeRemoveHandler);
bot.callbackQuery(/^copy:close:/, copyTradeCloseHandler);

bot.callbackQuery('settings:open', settingsOpenHandler);
bot.callbackQuery('settings:amount', settingsSetAmountHandler);
bot.callbackQuery('settings:tp', settingsSetTpHandler);
bot.callbackQuery('settings:sl', settingsSetSlHandler);
bot.callbackQuery('settings:maxpos', settingsSetMaxPositionsHandler);
bot.callbackQuery('settings:maxage', settingsSetMaxAgeHandler);
bot.callbackQuery('settings:slippage', settingsSetSlippageHandler);
bot.callbackQuery('settings:fee', settingsSetFeeHandler);
bot.callbackQuery('settings:mcap', settingsSetMcapHandler);
bot.callbackQuery('settings:devbuy', settingsSetDevBuyHandler);
bot.callbackQuery('settings:window', settingsSetWindowHandler);
bot.callbackQuery('settings:pause', settingsSetPauseHandler);
bot.callbackQuery('settings:cancel', settingsCancelHandler);

// Panel lama yang masih menampilkan tombol Atur Nominal/TP/SL.
bot.callbackQuery('copy:amount', settingsLegacyRedirectHandler);
bot.callbackQuery('copy:tp', settingsLegacyRedirectHandler);
bot.callbackQuery('copy:sl', settingsLegacyRedirectHandler);

bot.callbackQuery('pos:open', positionsHandler);
// Tetap didukung untuk panel lama yang masih menampilkan tombol Refresh.
bot.callbackQuery('pos:refresh', positionsHandler);
bot.callbackQuery(/^pos:close:/, positionsHandler);

bot.on('message:text', async (ctx, next) => {
  if (await scannerBuyTextHandler(ctx)) return;
  if (await settingsTextHandler(ctx)) return;
  if (await copyTradeTextHandler(ctx)) return;

  if (menuActionFor(ctx.message.text) !== undefined) {
    await menuTextHandler(ctx);
    return;
  }
  await next();
});

export async function bootstrap(): Promise<void> {
  scannerNotifier.init(bot.api, (chatId) => getUserLanguage(String(chatId)));
  scanner.setNotifier((chatIds, alert) => scannerNotifier.deliver(chatIds, alert));

  copyTradeNotifier.init(bot.api, (chatId) => getUserLanguage(String(chatId)));

  if (scanner.getConfig().autostart) {
    const result = scanner.start();
    if (!result.ok) {
      console.warn(`Scanner autostart gagal: ${result.reason ?? 'unknown'}`);
    } else {
      console.log(
        'Scanner autostart terhubung; alert hanya dikirim ke chat yang menekan Start Scan.',
      );
    }
  }

  await bot.start({
    onStart: (info) => {
      console.log(`✅ Bot @${info.username} started (polling)`);
    },
  });
}

export async function shutdown(): Promise<void> {
  scanner.stop();
  copyTrade.stopAll();
  await bot.stop();
}

process.once('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});

process.once('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
