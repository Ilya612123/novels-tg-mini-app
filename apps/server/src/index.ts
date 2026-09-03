import { loadConfig } from "./config.js";
import { prisma } from "./db.js";
import { createApiServer } from "./api.js";
import { createBot } from "./bot.js";
import { matchPendingTelegramAdsAttributions } from "./services/adsAttribution.js";
import { flushAnalyticsToTelegram } from "./services/analytics.js";
import { buildTelegramAdsRequestHeaders, collectTelegramAdsSnapshot } from "./telegramAds/collector.js";

const config = loadConfig();
const bot = createBot({ config, db: prisma });
const app = createApiServer({ config, db: prisma, bot });

app.listen(config.PORT, () => {
  console.log(`Server listening on ${config.PORT}`);
});

if (config.BOT_MODE === "polling") {
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  bot.start();
} else {
  console.log("Bot polling disabled; webhook mode is active");
}

setInterval(() => {
  flushAnalyticsToTelegram({
    db: prisma,
    bot,
    chatId: config.ANALYTICS_USER_ID,
    botStartDelaySeconds:
      config.TELEGRAM_ADS_UNKNOWN_AFTER_SECONDS + Math.ceil(config.TELEGRAM_ADS_MATCH_INTERVAL_MS / 1000)
  }).catch(console.error);
}, 60_000);

let isCollecting = false;
let isMatching = false;
let telegramAdsCookieAlertSent = false;

setInterval(() => {
  if (isCollecting) return;
  isCollecting = true;
  collectTelegramAdsSnapshot(prisma, {
    headers: buildTelegramAdsRequestHeaders({
      cookie: config.TELEGRAM_ADS_COOKIE,
      headersJson: config.TELEGRAM_ADS_REQUEST_HEADERS_JSON
    })
    })
    .then((result) => {
      if (result.ok) {
        telegramAdsCookieAlertSent = false;
        return;
      }
      console.error("Telegram Ads collection failed; failure snapshot recorded");
      if (result.authLikelyExpired && !telegramAdsCookieAlertSent) {
        telegramAdsCookieAlertSent = true;
        bot.api
          .sendMessage(
            config.ANALYTICS_USER_ID,
            "Telegram Ads collector: похоже, cookie сессии истекла. Обновите TELEGRAM_ADS_COOKIE на сервере."
          )
          .catch((error) => {
            console.error("Telegram Ads auth alert failed", error);
          });
      }
    })
    .catch((error) => {
      console.error("Telegram Ads collection interval failed", error);
    })
    .finally(() => {
      isCollecting = false;
    });
}, config.TELEGRAM_ADS_COLLECT_INTERVAL_MS);

setInterval(() => {
  if (isMatching) return;
  isMatching = true;
  matchPendingTelegramAdsAttributions(prisma, {
    beforeWindowSeconds: config.TELEGRAM_ADS_MATCH_WINDOW_BEFORE_SECONDS,
    afterWindowSeconds: config.TELEGRAM_ADS_MATCH_WINDOW_AFTER_SECONDS,
    unknownAfterSeconds: config.TELEGRAM_ADS_UNKNOWN_AFTER_SECONDS,
    limit: 100
  })
    .catch((error) => {
      console.error("Telegram Ads attribution match interval failed", error);
    })
    .finally(() => {
      isMatching = false;
    });
}, config.TELEGRAM_ADS_MATCH_INTERVAL_MS);
