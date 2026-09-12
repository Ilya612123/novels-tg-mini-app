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
    .filter(([key]) => key !== "bookId")
    .map(([key, value]) => {
      const formattedValue = formatMetadataValue(value);
      return formattedValue == null ? null : `${key}=${formattedValue}`;
    })
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function metadataRecord(metadata: unknown): Record<string, unknown> | null {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : null;
}

function numberMetadata(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringMetadata(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} мс`;
  const seconds = durationMs / 1000;
  return `${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)} сек`;
}

function formatReaderEvent(event: AnalyticsEventForFormat): string | null {
  const metadata = metadataRecord(event.metadata);
  if (!metadata) return null;

  if (event.label === "открыл главу") {
    const chapterNumber = numberMetadata(metadata, "chapterNumber");
    const chapterTitle = stringMetadata(metadata, "chapterTitle");
    const bookTitle = stringMetadata(metadata, "bookTitle");
    if (chapterNumber && chapterTitle && bookTitle) return `Открыл главу ${chapterNumber} «${chapterTitle}» в «${bookTitle}»`;
  }

  if (event.label === "загрузка главы завершилась") {
    const chapterNumber = numberMetadata(metadata, "chapterNumber");
    const durationMs = numberMetadata(metadata, "durationMs");
    const status = stringMetadata(metadata, "status");
    if (chapterNumber && durationMs != null && status === "success") return `Глава ${chapterNumber} загрузилась за ${formatDuration(durationMs)}`;
    if (chapterNumber && durationMs != null && status === "locked") return `Глава ${chapterNumber} уперлась в paywall за ${formatDuration(durationMs)}`;
    if (chapterNumber && durationMs != null && status === "error") return `Глава ${chapterNumber} не загрузилась за ${formatDuration(durationMs)}`;
  }

  if (event.label.startsWith("читает главу ")) {
    const chapterNumber = numberMetadata(metadata, "chapterNumber");
    const percent = numberMetadata(metadata, "percent");
    if (chapterNumber && percent) return `Читает главу ${chapterNumber}: ${percent}%`;
  }

  if (event.label === "нажал вперед" || event.label === "нажал назад") {
    const fromChapterNumber = numberMetadata(metadata, "fromChapterNumber");
    const toChapterNumber = numberMetadata(metadata, "toChapterNumber");
    if (fromChapterNumber && toChapterNumber) {
      return `${event.label === "нажал вперед" ? "Нажал вперед" : "Нажал назад"}: глава ${fromChapterNumber} -> ${toChapterNumber}`;
    }
  }

  if (event.label === "вышел из чтения главы") {
    const chapterNumber = numberMetadata(metadata, "chapterNumber");
    const bookTitle = stringMetadata(metadata, "bookTitle");
    if (chapterNumber && bookTitle) return `Вышел из чтения главы ${chapterNumber} в «${bookTitle}»`;
  }

  return null;
}

function formatPushTarget(metadata: Record<string, unknown>): string {
  const bookTitle = stringMetadata(metadata, "bookTitle");
  const chapterNumber = numberMetadata(metadata, "chapterNumber");
  if (bookTitle && chapterNumber) return ` по «${bookTitle}», глава ${chapterNumber}`;
  if (bookTitle) return ` по «${bookTitle}»`;
  if (chapterNumber) return `, глава ${chapterNumber}`;
  return "";
}

function formatPushMessage(metadata: Record<string, unknown>): string {
  const messageText = stringMetadata(metadata, "messageText");
  return messageText ? `: «${messageText}»` : "";
}

function formatSuppressionReason(reason: string | null): string {
  if (reason === "active_access") return "уже есть активная подписка";
  if (reason === "target_completed") return "цель уже выполнена";
  if (reason === "duplicate_recently_sent") return "пользователь недавно получал такой пуш";
  if (reason === "min_hours_between_messages") return "слишком скоро после прошлого пуша";
  if (reason === "max_per_day") return "дневной лимит пушей";
  if (reason === "max_per_week") return "недельный лимит пушей";
  return reason ?? "сработало ограничение";
}

function formatPushEvent(event: AnalyticsEventForFormat): string | null {
  const metadata = metadataRecord(event.metadata);
  if (!metadata) return null;

  const target = formatPushTarget(metadata);
  const message = formatPushMessage(metadata);

  if (event.label === "push_scheduled") return `Запланировали пуш${target}${message}`;
  if (event.label === "push_sent") return `Пуш отправлен${target}${message}`;
  if (event.label === "push_failed") {
    const failureReason = stringMetadata(metadata, "failureReason");
    return `Пуш не отправился${target}${failureReason ? `: ${failureReason}` : ""}`;
  }
  if (event.label.startsWith("push_suppressed_")) {
    return `Пуш не отправлен${target}: ${formatSuppressionReason(stringMetadata(metadata, "suppressionReason"))}`;
  }

  return null;
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
      lines.push(`  ${formatTime(event.occurredAt)} ${formatReaderEvent(event) ?? formatPushEvent(event) ?? `${event.label}${formatMetadata(event.metadata)}`}`);
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
