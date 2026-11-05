import { bootstrap } from './bot.js';
import { BOT_NAME } from './config.js';

async function main(): Promise<void> {
  console.log(`Starting ${BOT_NAME}...`);
  await bootstrap();
}

main().catch((error: unknown) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
