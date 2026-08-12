import type { BookSummary, ChapterDto } from "@novell-reader/shared";
import { getTelegramInitData } from "../telegram";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

type ApiRequestOptions = RequestInit & {
  expectedStatuses?: number[];
};

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { expectedStatuses = [], ...fetchOptions } = options;
  const res = await fetch(path, {
    ...fetchOptions,
    headers: {
      "content-type": "application/json",
      "x-telegram-init-data": getTelegramInitData(),
      ...fetchOptions.headers
    }
  });
  if (!res.ok && !expectedStatuses.includes(res.status)) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `Ошибка API: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type LockedChapter = { canRead: false; reason: "paywall" };
export type PaymentResponse = { invoiceLink: string; providerPayload: string };

export const api = {
  books: () => request<BookSummary[]>("/api/books"),
  book: (bookId: string) => request<BookSummary>(`/api/books/${bookId}`),
  chapter: (bookId: string, chapterNumber: number) =>
    request<ChapterDto | LockedChapter>(`/api/books/${bookId}/chapters/${chapterNumber}`, { expectedStatuses: [402] }),
  saveProgress: (body: { bookId: string; chapterNumber: number; position: number; percent: number | null }) =>
    request("/api/progress", { method: "POST", body: JSON.stringify(body) }),
  analytics: (label: string, metadata?: unknown) =>
    request("/api/analytics", { method: "POST", body: JSON.stringify({ label, metadata }) }),
  createPayment: () => request<PaymentResponse>("/api/payments/create", { method: "POST" })
};
