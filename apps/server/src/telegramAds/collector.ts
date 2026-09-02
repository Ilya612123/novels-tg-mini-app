import type { DbClient } from "../db.js";
import { recordTelegramAdsCollectionFailure, recordTelegramAdsSnapshot } from "../repositories/telegramAds.js";
import { parseTelegramAdsMetrics } from "./parser.js";

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  headers: { get: (name: string) => string | null };
}>;

const TELEGRAM_ADS_ACCOUNT_URL = "https://ads.telegram.org/account";

export type TelegramAdsCollectorConfig = {
  headers?: Record<string, string>;
  fetchImpl?: FetchLike;
};

export type TelegramAdsCollectorResult = {
  ok: boolean;
  metricsCount: number;
  deltasCreated: number;
  authLikelyExpired?: boolean;
  errorMessage?: string;
};

export function buildTelegramAdsRequestHeaders(input: {
  cookie?: string;
  headersJson?: string;
}): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  if (input.headersJson) {
    const parsed = JSON.parse(input.headersJson) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value) headers[key.toLowerCase()] = value;
    }
  }
  if (input.cookie) headers.cookie = input.cookie;
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function parseResponseBody(body: string, contentType: string | null): unknown {
  if (contentType?.includes("json")) return JSON.parse(body);
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  return body;
}

function isAuthFailure(responseStatus: number | null, body?: string): boolean {
  if (responseStatus === 401 || responseStatus === 403) return true;
  if (!body) return false;
  return /\/auth|log in with telegram|telegram login|auth cookie is likely expired/i.test(body);
}

export async function collectTelegramAdsSnapshot(
  db: DbClient,
  config: TelegramAdsCollectorConfig
): Promise<TelegramAdsCollectorResult> {
  try {
    const fetchImpl = config.fetchImpl ?? fetch;
    const response = await fetchImpl(TELEGRAM_ADS_ACCOUNT_URL, { headers: config.headers });
    const body = await response.text();
    if (!response.ok) throw new Error(`Telegram Ads collector request failed with status ${response.status}`);
    if (isAuthFailure(response.status, body)) throw new Error("Telegram Ads auth cookie is likely expired");

    const rawPayload = parseResponseBody(body, response.headers.get("content-type"));
    const metrics = parseTelegramAdsMetrics(rawPayload);
    const result = await recordTelegramAdsSnapshot(db, { rawPayload, metrics });
    return { ok: true, metricsCount: metrics.length, deltasCreated: result.deltasCreated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await recordTelegramAdsCollectionFailure(db, {
      errorMessage
    });
    return {
      ok: false,
      metricsCount: 0,
      deltasCreated: 0,
      authLikelyExpired: isAuthFailure(null, errorMessage),
      errorMessage
    };
  }
}
