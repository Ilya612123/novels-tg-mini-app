import "dotenv/config";
import { z } from "zod";

export const DEFAULT_DATABASE_URL = "file:./dev.db";

export function ensureDatabaseUrl(env = process.env) {
  if (!env.DATABASE_URL) {
    env.DATABASE_URL = DEFAULT_DATABASE_URL;
  }
}

ensureDatabaseUrl();

const EnvSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  MINI_APP_URL: z.string().url().optional(),
  SUPPORT_URL: z.string().url().default("https://t.me/esimsmile_support"),
  ANALYTICS_USER_ID: z.string().min(1),
  STARS_ACCESS_PRICE: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
  PUBLIC_BASE_URL: z.string().url().optional(),
  MINI_APP_DIST_DIR: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  BOT_MODE: z.enum(["polling", "webhook"]).default("webhook"),
  TELEGRAM_ADS_COLLECT_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  TELEGRAM_ADS_MATCH_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  TELEGRAM_ADS_MATCH_WINDOW_BEFORE_SECONDS: z.coerce.number().int().positive().default(60),
  TELEGRAM_ADS_MATCH_WINDOW_AFTER_SECONDS: z.coerce.number().int().positive().default(180),
  TELEGRAM_ADS_UNKNOWN_AFTER_SECONDS: z.coerce.number().int().positive().default(600),
  TELEGRAM_ADS_COOKIE: z.string().min(1).optional(),
  TELEGRAM_ADS_REQUEST_HEADERS_JSON: z.string().min(1).optional()
});

type ParsedEnv = z.infer<typeof EnvSchema>;
export type AppConfig = Omit<ParsedEnv, "MINI_APP_URL"> & { MINI_APP_URL: string };

function normalizeOptionalEnv(env: NodeJS.ProcessEnv) {
  for (const key of [
    "MINI_APP_URL",
    "PUBLIC_BASE_URL",
    "MINI_APP_DIST_DIR",
    "TELEGRAM_ADS_COOKIE",
    "TELEGRAM_ADS_REQUEST_HEADERS_JSON"
  ] as const) {
    if (env[key] === "") {
      delete env[key];
    }
  }
}

export function loadConfig(env = process.env): AppConfig {
  ensureDatabaseUrl(env);
  normalizeOptionalEnv(env);
  const config = EnvSchema.parse(env);
  return {
    ...config,
    MINI_APP_URL: config.MINI_APP_URL ?? config.PUBLIC_BASE_URL ?? `http://localhost:${config.PORT}`
  };
}
