import { loadConfig } from "./config.js";
import { prisma } from "./db.js";
import { createApiServer } from "./api.js";
import { createBot } from "./bot.js";
import { flushAnalyticsToTelegram } from "./services/analytics.js";

const config = loadConfig();
const bot = createBot({ config, db: prisma });
const app = createApiServer({ config, db: prisma, bot });

app.listen(config.PORT, () => {
  console.log(`Server listening on ${config.PORT}`);
});

if (config.BOT_MODE === "polling") {
  bot.start();
} else {
  console.log("Bot polling disabled; webhook mode is active");
}

setInterval(() => {
  flushAnalyticsToTelegram({ db: prisma, bot, channelId: config.ANALYTICS_CHANNEL_ID }).catch(console.error);
}, 60_000);
