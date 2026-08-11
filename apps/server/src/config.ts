import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  MINI_APP_URL: z.string().url(),
  SUPPORT_URL: z.string().url().default("https://t.me/esimsmile_support"),
  ANALYTICS_CHANNEL_ID: z.string().min(1),
  STARS_ACCESS_PRICE: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1),
  PUBLIC_BASE_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(3000)
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env = process.env): AppConfig {
  return EnvSchema.parse(env);
}
