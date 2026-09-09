import type { TelegramAdsSnapshot } from "@prisma/client";
import type { DbClient } from "../db.js";

const TELEGRAM_ADS_RAW_PAYLOAD_RETENTION_MS = 24 * 60 * 60 * 1000;

export type NormalizedTelegramAdMetric = {
  adKey: string;
  adTitle: string;
  views: number;
  clicks: number;
  actions: number;
  spent: number;
};

function serializeRawPayload(rawPayload: unknown): string | null {
  return rawPayload == null ? null : JSON.stringify(rawPayload);
}

export async function recordTelegramAdsSnapshot(
  db: DbClient,
  input: {
    collectedAt?: Date;
    rawPayload?: unknown;
    metrics: NormalizedTelegramAdMetric[];
  }
): Promise<{ snapshotId: string; deltasCreated: number }> {
  const collectedAt = input.collectedAt ?? new Date();
  const previousSnapshot = await db.telegramAdsSnapshot.findFirst({
    where: {
      status: "success",
      collectedAt: { lt: collectedAt }
    },
    orderBy: { collectedAt: "desc" },
    include: { metrics: true }
  });

  const snapshot = await db.telegramAdsSnapshot.create({
    data: {
      collectedAt,
      status: "success",
      rawPayload: serializeRawPayload(input.rawPayload),
      metrics: {
        create: input.metrics.map((metric) => ({
          adKey: metric.adKey,
          adTitle: metric.adTitle,
          views: metric.views,
          clicks: metric.clicks,
          actions: metric.actions,
          spent: metric.spent
        }))
      }
    }
  });

  if (!previousSnapshot) return { snapshotId: snapshot.id, deltasCreated: 0 };

  const previousByAdKey = new Map(previousSnapshot.metrics.map((metric) => [metric.adKey, metric]));
  const deltas = input.metrics.flatMap((metric) => {
    const previous = previousByAdKey.get(metric.adKey);
    if (!previous) return [];
    const delta = metric.actions - previous.actions;
    if (delta <= 0) return [];
    return {
      adKey: metric.adKey,
      adTitle: metric.adTitle,
      delta,
      observedFrom: previousSnapshot.collectedAt,
      observedTo: collectedAt,
      fromSnapshotId: previousSnapshot.id,
      toSnapshotId: snapshot.id
    };
  });

  if (deltas.length > 0) {
    await db.telegramAdActionDelta.createMany({ data: deltas });
  }

  return { snapshotId: snapshot.id, deltasCreated: deltas.length };
}

export async function recordTelegramAdsCollectionFailure(
  db: DbClient,
  input: {
    collectedAt?: Date;
    errorMessage: string;
    rawPayload?: unknown;
  }
): Promise<TelegramAdsSnapshot> {
  return db.telegramAdsSnapshot.create({
    data: {
      collectedAt: input.collectedAt ?? new Date(),
      status: "failed",
      errorMessage: input.errorMessage,
      rawPayload: serializeRawPayload(input.rawPayload)
    }
  });
}

export async function rotateTelegramAdsSnapshotRawPayloads(
  db: DbClient,
  now = new Date()
): Promise<{ cleanedSnapshots: number }> {
  const cutoff = new Date(now.getTime() - TELEGRAM_ADS_RAW_PAYLOAD_RETENTION_MS);
  const result = await db.telegramAdsSnapshot.updateMany({
    where: {
      status: "success",
      collectedAt: { lt: cutoff },
      rawPayload: { not: null }
    },
    data: {
      rawPayload: null
    }
  });

  return { cleanedSnapshots: result.count };
}
