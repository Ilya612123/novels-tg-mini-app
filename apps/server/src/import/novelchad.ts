import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import sharp from "sharp";
import slugify from "slugify";
import { calculateFreeChapterLimit } from "@novell-reader/shared";
import type { DbClient } from "../db.js";

export type NovelChadChapter = {
  number: number;
  title: string;
  url: string;
};

export type ParsedNovelChadNovel = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  tags: string[];
  chapters: NovelChadChapter[];
};

export type ImportNovelChadInput = {
  db: DbClient;
  url: string;
  outputDir: string;
  fetchHtml?: (url: string) => Promise<string>;
  fetchBuffer?: (url: string) => Promise<Buffer>;
};

export type NovelChadImportSummary = {
  importedBooks: number;
  importedChapters: number;
  skippedChapters: string[];
};

type NovelChadChapterEntry = {
  url?: string;
  is_free?: boolean;
};

function metaContent($: cheerio.CheerioAPI, selector: string): string | null {
  const value = $(selector).first().attr("content")?.trim();
  return value ? value : null;
}

function extractNovelId(url: string): string {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\/novel\/([^/]+)/);
  if (!match) throw new Error(`NovelChad novel URL is invalid: ${url}`);
  return match[1];
}

function makeBookId(novelId: string): string {
  const slug = slugify(novelId, { lower: true, strict: true, trim: true });
  return `novelchad-${slug || novelId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function normalizeNovelTitle(value: string): string {
  return value
    .replace(/\[[^\]]+\]\s*—.*$/u, "")
    .replace(/\s+—\s+.*$/u, "")
    .split(" / ")[0]
    .trim();
}

function isServiceTag(tag: string): boolean {
  return /^(18\+|онгоинг|завершено|заморожено)$/i.test(tag) || /^ориг:\s*\d+\s*гл\.?$/i.test(tag);
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawTag of tags) {
    const tag = rawTag.replace(/\s+/g, " ").trim();
    const key = tag.toLocaleLowerCase("ru");
    if (!tag || isServiceTag(tag) || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }

  return result;
}

function parseJsonLdGenres($: cheerio.CheerioAPI): string[] {
  const genres: string[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== "object" || !("genre" in item)) continue;
        const genre = (item as { genre?: unknown }).genre;
        if (Array.isArray(genre)) {
          genres.push(...genre.filter((value): value is string => typeof value === "string"));
        } else if (typeof genre === "string") {
          genres.push(...genre.split(","));
        }
      }
    } catch {
      // Ignore malformed JSON-LD; tags are optional metadata.
    }
  });

  return genres;
}

function parseNovelTags($: cheerio.CheerioAPI): string[] {
  const articleTags = metaContent($, "meta[property='article:tag']")
    ?.split(",")
    .map((tag) => tag.trim());
  return normalizeTags(articleTags && articleTags.length > 0 ? articleTags : parseJsonLdGenres($));
}

function extractWindowChapters(html: string): Record<string, NovelChadChapterEntry> {
  const match = html.match(/window\.chapters\s*=\s*(\{[\s\S]*?\});/);
  if (!match) throw new Error("NovelChad page does not contain window.chapters");

  const parsed = JSON.parse(match[1]) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("NovelChad chapters payload is not an object");
  }

  return parsed as Record<string, NovelChadChapterEntry>;
}

export function parseNovelChadNovelPage(html: string, url: string): ParsedNovelChadNovel {
  const $ = cheerio.load(html);
  const id = extractNovelId(url);
  const rawTitle = metaContent($, "meta[property='og:title']") ?? $("title").first().text().trim() ?? id;
  const chapters = Object.entries(extractWindowChapters(html))
    .map(([number, chapter]) => ({ number: Number(number), chapter }))
    .filter(({ number, chapter }) => Number.isFinite(number) && chapter.is_free === true && typeof chapter.url === "string")
    .sort((a, b) => a.number - b.number)
    .map(({ number, chapter }) => ({
      number,
      title: `Глава ${number}`,
      url: new URL(chapter.url as string, url).toString()
    }));

  return {
    id,
    title: normalizeNovelTitle(rawTitle) || id,
    description: metaContent($, "meta[property='og:description'], meta[name='description']"),
    coverUrl: metaContent($, "meta[property='og:image'], meta[name='twitter:image']"),
    tags: parseNovelTags($),
    chapters
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function processInlineFormatting(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, "$1<em>$2</em>");
}

export function renderNovelChadChapterHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let inPoetry = false;
  let poetryLines: string[] = [];

  function flushPoetry() {
    if (!inPoetry) return;
    blocks.push(`<div class="poetry">${poetryLines.join("<br />")}</div>`);
    poetryLines = [];
    inPoetry = false;
  }

  for (const line of lines) {
    if (/^\s*\*\s*\*\s*\*\s*$/.test(line)) {
      flushPoetry();
      blocks.push("<hr />");
      continue;
    }

    const startsWithTilde = line.trimStart().startsWith("~");
    const endsWithTilde = line.trimEnd().endsWith("~");
    if (startsWithTilde || endsWithTilde) {
      let poetryLine = line;
      if (startsWithTilde) {
        poetryLine = poetryLine.replace(/^\s*~\s*/, "");
        inPoetry = true;
      }
      if (endsWithTilde) poetryLine = poetryLine.replace(/\s*~\s*$/, "");
      if (poetryLine.trim()) poetryLines.push(processInlineFormatting(poetryLine));
      if (endsWithTilde) flushPoetry();
      continue;
    }

    if (inPoetry) {
      if (line.trim()) poetryLines.push(processInlineFormatting(line));
      continue;
    }

    if (line.trim()) blocks.push(`<p>${processInlineFormatting(line)}</p>`);
  }

  flushPoetry();

  return sanitizeHtml(blocks.join("\n"), {
    allowedTags: ["p", "br", "strong", "em", "i", "b", "h1", "h2", "h3", "blockquote", "hr", "div"],
    allowedAttributes: {
      div: ["class"]
    },
    allowedClasses: {
      div: ["poetry"]
    }
  });
}

function decodeContentData(value: string): string {
  const decoded = Buffer.from(value, "base64").toString("utf8");
  try {
    return decodeURIComponent(decoded);
  } catch {
    return decoded;
  }
}

function extractChapterContentData(html: string): string {
  const match = html.match(/\bcontentData\s*=\s*(['"])([A-Za-z0-9+/=]+)\1/);
  if (!match) throw new Error("NovelChad chapter page does not contain contentData");
  return decodeContentData(match[2]);
}

function chapterTitleFromPage(html: string, fallback: string): string {
  const $ = cheerio.load(html);
  return $(".header-title").first().text().trim() || $("h1").first().text().trim() || fallback;
}

function isPaywallText(text: string): boolean {
  return /premium|подписк|оформите подписку|buy_premium/i.test(text);
}

function countWords(html: string): number {
  const text = cheerio.load(html).text();
  const words = text.match(/[\p{L}\p{N}]+/gu);
  return words?.length ?? 0;
}

async function defaultFetchHtml(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed ${response.status}: ${url}`);
  return response.text();
}

async function defaultFetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function saveCover(fetchBuffer: (url: string) => Promise<Buffer>, coverUrl: string | null, bookOutputDir: string): Promise<string | null> {
  if (!coverUrl) return null;

  try {
    const relativePath = path.join(path.basename(bookOutputDir), "cover.webp");
    const image = await fetchBuffer(coverUrl);
    await sharp(image).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toFile(path.join(bookOutputDir, "cover.webp"));
    return relativePath;
  } catch {
    return null;
  }
}

export async function importNovelChadNovel(input: ImportNovelChadInput): Promise<NovelChadImportSummary> {
  const fetchHtml = input.fetchHtml ?? defaultFetchHtml;
  const fetchBuffer = input.fetchBuffer ?? defaultFetchBuffer;
  const novelPage = await fetchHtml(input.url);
  const novel = parseNovelChadNovelPage(novelPage, input.url);
  const bookId = makeBookId(novel.id);
  const bookOutputDir = path.join(input.outputDir, bookId);
  const chaptersOutputDir = path.join(bookOutputDir, "chapters");
  const skippedChapters: string[] = [];

  await fs.rm(bookOutputDir, { recursive: true, force: true });
  await fs.mkdir(chaptersOutputDir, { recursive: true });

  const importedChapters: Array<{
    id: string;
    number: number;
    title: string;
    contentPath: string;
    wordCount: number;
  }> = [];

  for (const chapter of novel.chapters) {
    try {
      const page = await fetchHtml(chapter.url);
      const text = extractChapterContentData(page);
      if (isPaywallText(text)) {
        skippedChapters.push(`${chapter.number}: paywall content`);
        continue;
      }

      const html = renderNovelChadChapterHtml(text);
      const contentPath = path.join(bookId, "chapters", `${chapter.number}.html`);
      await fs.writeFile(path.join(input.outputDir, contentPath), html, "utf8");
      importedChapters.push({
        id: `${bookId}-${chapter.number}`,
        number: chapter.number,
        title: chapterTitleFromPage(page, chapter.title),
        contentPath,
        wordCount: countWords(html)
      });
    } catch (error) {
      skippedChapters.push(`${chapter.number}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const coverPath = await saveCover(fetchBuffer, novel.coverUrl, bookOutputDir);
  const chapterCount = importedChapters.length;
  const freeChapterLimit = calculateFreeChapterLimit(chapterCount);

  await input.db.book.upsert({
    where: { id: bookId },
    create: {
      id: bookId,
      title: novel.title,
      author: null,
      description: novel.description,
      tagsJson: JSON.stringify(novel.tags),
      coverPath,
      chapterCount,
      freeChapterLimit,
      sourceEpubFile: input.url,
      status: "published"
    },
    update: {
      title: novel.title,
      author: null,
      description: novel.description,
      tagsJson: JSON.stringify(novel.tags),
      coverPath,
      chapterCount,
      freeChapterLimit,
      sourceEpubFile: input.url,
      status: "published"
    }
  });

  await input.db.chapter.deleteMany({ where: { bookId } });
  if (importedChapters.length > 0) {
    await input.db.chapter.createMany({
      data: importedChapters.map((chapter) => ({
        ...chapter,
        bookId
      }))
    });
  }

  return {
    importedBooks: 1,
    importedChapters: importedChapters.length,
    skippedChapters
  };
}
