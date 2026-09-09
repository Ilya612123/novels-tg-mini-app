import * as cheerio from "cheerio";
import type { NormalizedTelegramAdMetric } from "../repositories/telegramAds.js";

type RawMetricRecord = Record<string, unknown>;

function parseNumber(value: unknown, field: string): number {
  if (value == null || value === "") throw new Error(`Telegram Ads metric is missing ${field}`);
  if (typeof value === "number") return value;
  const normalized = String(value).replace(/[^0-9.-]/g, "");
  if (!normalized) throw new Error(`Telegram Ads metric has invalid ${field}`);
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Telegram Ads metric has invalid ${field}`);
  return parsed;
}

function parseNullableCounter(value: unknown, field: string): number {
  if (value == null || value === "") return 0;
  return parseNumber(value, field);
}

function requireText(value: unknown, field: string): string {
  if (value == null || String(value).trim() === "") throw new Error(`Telegram Ads metric is missing ${field}`);
  return String(value).trim();
}

function normalizeRecord(record: RawMetricRecord): NormalizedTelegramAdMetric {
  return {
    adKey: requireText(record.adKey ?? record.key ?? record.id ?? record.ad_id, "adKey"),
    adTitle: requireText(record.adTitle ?? record.title ?? record.name, "adTitle"),
    views: parseNumber(record.views, "views"),
    clicks: parseNumber(record.clicks, "clicks"),
    actions: parseNullableCounter(record.actions, "actions"),
    spent: parseNumber(record.spent, "spent")
  };
}

function recordsFromJson(raw: unknown): RawMetricRecord[] {
  if (Array.isArray(raw)) return raw as RawMetricRecord[];
  if (raw && typeof raw === "object") {
    const object = raw as Record<string, unknown>;
    if (Array.isArray(object.ads)) return object.ads as RawMetricRecord[];
    if (Array.isArray(object.data)) return object.data as RawMetricRecord[];
    if (Array.isArray(object.items)) return object.items as RawMetricRecord[];
  }
  throw new Error("Telegram Ads payload does not contain metrics");
}

function extractAjInitState(raw: string): unknown | null {
  const marker = "ajInit(";
  const start = raw.indexOf(marker);
  if (start < 0) return null;

  let depth = 0;
  let inString: string | null = null;
  let escaped = false;
  const jsonStart = start + marker.length;

  for (let index = jsonStart; index < raw.length; index += 1) {
    const char = raw[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === inString) inString = null;
      continue;
    }
    if (char === "\"" || char === "'") {
      inString = char;
    } else if (char === "{" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        const payload = JSON.parse(raw.slice(jsonStart, index + 1)) as { state?: { initialAdsList?: { items?: unknown } } };
        return payload.state?.initialAdsList?.items ?? null;
      }
    }
  }
  return null;
}

function parseHtml(raw: string): NormalizedTelegramAdMetric[] {
  const initialAds = extractAjInitState(raw);
  if (initialAds) return recordsFromJson(initialAds).map(normalizeRecord);

  const $ = cheerio.load(raw);
  const metrics: NormalizedTelegramAdMetric[] = [];

  $("tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((__, cell) => $(cell).text().trim())
      .get();
    if (cells.length < 5) return;
    metrics.push(
      normalizeRecord({
        adKey: $(row).attr("data-ad-key") ?? cells[0],
        adTitle: cells[0],
        views: cells[1],
        clicks: cells[2],
        actions: cells[3],
        spent: cells[4]
      })
    );
  });

  if (metrics.length === 0) throw new Error("Telegram Ads HTML payload does not contain metric rows");
  return metrics;
}

export function parseTelegramAdsMetrics(raw: unknown): NormalizedTelegramAdMetric[] {
  if (typeof raw === "string" && raw.trim().startsWith("<")) return parseHtml(raw);
  return recordsFromJson(raw).map(normalizeRecord);
}
