import { runTelegramDigest } from '#app/server/telegram-digest.mjs';

process.exitCode = await runTelegramDigest({ now: new Date(), fetch: globalThis.fetch });
