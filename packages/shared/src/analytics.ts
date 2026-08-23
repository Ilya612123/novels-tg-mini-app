export type AnalyticsEventSource = "bot" | "miniapp";

export type AnalyticsEventForFormat = {
  userId: string;
  username: string | null;
  occurredAt: Date;
  label: string;
  metadata?: unknown;
  source: AnalyticsEventSource;
};

export type AnalyticsBatchInput = {
  from: Date;
  to: Date;
  events: AnalyticsEventForFormat[];
};

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function formatMinute(date: Date): string {
  return formatTime(date).slice(0, 5);
}

function formatMetadataValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function formatMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";

  const parts = Object.entries(metadata)
    .map(([key, value]) => {
      const formattedValue = formatMetadataValue(value);
      return formattedValue == null ? null : `${key}=${formattedValue}`;
    })
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function formatAnalyticsBatch(input: AnalyticsBatchInput): string | null {
  if (input.events.length === 0) return null;

  const grouped = new Map<string, AnalyticsEventForFormat[]>();
  for (const event of input.events) {
    const list = grouped.get(event.userId) ?? [];
    list.push(event);
    grouped.set(event.userId, list);
  }

  const lines = [`Логи за ${formatMinute(input.from)}-${formatMinute(input.to)}`, ""];

  for (const [userId, events] of grouped) {
    events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const username = events.find((event) => event.username)?.username;
    lines.push(`user ${userId}${username ? ` @${username}` : ""}`);

    for (const event of events) {
      lines.push(`  ${formatTime(event.occurredAt)} ${event.label}${formatMetadata(event.metadata)}`);
    }

    const miniappEvents = events.filter((event) => event.source === "miniapp");
    if (miniappEvents.length >= 2) {
      const first = miniappEvents[0]!.occurredAt.getTime();
      const last = miniappEvents[miniappEvents.length - 1]!.occurredAt.getTime();
      lines.push(`  активность в mini app: ${Math.max(0, Math.round((last - first) / 1000))} сек`);
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
