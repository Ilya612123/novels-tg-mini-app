import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import slugify from "slugify";
import { calculateFreeChapterLimit } from "@novell-reader/shared";
import type { DbClient } from "../db.js";

export type ImportEpubDirectoryInput = {
  db: DbClient;
  sourceDir: string;
  outputDir: string;
};

export type ImportSummary = {
  importedBooks: number;
  importedChapters: number;
  skippedFiles: string[];
};

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
};

type SpineItem = {
  idref: string;
  linear: string | null;
};

type ParsedOpf = {
  baseDir: string;
  title: string;
  author: string | null;
  language: string | null;
  coverId: string | null;
  manifest: Map<string, ManifestItem>;
  spine: SpineItem[];
};

type TocEntry = {
  title: string;
  src: string;
};

export function shouldSkipChapterTitle(title: string): boolean {
  return ["cover", "информация о книге", "об авторе", "оглавление"].includes(title.trim().toLowerCase());
}

export function extractChapterNumber(title: string): number | null {
  const match = title.match(/глава\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function normalizeZipPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join("/")
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .replace(/^\.?\//, "");
}

function textOf($: cheerio.CheerioAPI, selector: string): string | null {
  const text = $(selector).first().text().trim();
  return text.length > 0 ? text : null;
}

function makeBookId(title: string, fileName: string): string {
  const base = slugify(title || path.basename(fileName, path.extname(fileName)), {
    lower: true,
    strict: true,
    locale: "ru",
    trim: true
  });
  return base || path.basename(fileName, path.extname(fileName)).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function readZipText(zip: AdmZip, entryPath: string): string {
  const entry = zip.getEntry(entryPath);
  if (!entry) throw new Error(`EPUB entry not found: ${entryPath}`);
  return entry.getData().toString("utf8");
}

function findOpfPath(zip: AdmZip): string {
  const containerXml = readZipText(zip, "META-INF/container.xml");
  const $ = cheerio.load(containerXml, { xmlMode: true });
  const fullPath = $("rootfile").first().attr("full-path");
  if (!fullPath) throw new Error("EPUB container.xml does not contain rootfile full-path");
  return fullPath;
}

function parseOpf(zip: AdmZip, opfPath: string): ParsedOpf {
  const opfXml = readZipText(zip, opfPath);
  const $ = cheerio.load(opfXml, { xmlMode: true });
  const baseDir = path.posix.dirname(opfPath) === "." ? "" : path.posix.dirname(opfPath);
  const manifest = new Map<string, ManifestItem>();

  $("manifest item").each((_, element) => {
    const item = $(element);
    const id = item.attr("id");
    const href = item.attr("href");
    const mediaType = item.attr("media-type");
    if (id && href && mediaType) {
      manifest.set(id, { id, href, mediaType });
    }
  });

  const spine: SpineItem[] = [];
  $("spine itemref").each((_, element) => {
    const item = $(element);
    const idref = item.attr("idref");
    if (idref) spine.push({ idref, linear: item.attr("linear") ?? null });
  });

  return {
    baseDir,
    title: textOf($, "metadata title, dc\\:title") ?? "Без названия",
    author: textOf($, "metadata creator, dc\\:creator"),
    language: textOf($, "metadata language, dc\\:language"),
    coverId: $("metadata meta[name='cover']").first().attr("content") ?? null,
    manifest,
    spine
  };
}

function parseToc(zip: AdmZip, opf: ParsedOpf): TocEntry[] {
  const ncxItem = [...opf.manifest.values()].find((item) => item.mediaType === "application/x-dtbncx+xml");
  if (!ncxItem) return [];

  const tocPath = normalizeZipPath(opf.baseDir, ncxItem.href);
  const $ = cheerio.load(readZipText(zip, tocPath), { xmlMode: true });
  const entries: TocEntry[] = [];

  $("navPoint").each((_, element) => {
    const point = $(element);
    const title = point.find("navLabel text").first().text().trim();
    const src = point.find("content").first().attr("src");
    if (title && src) entries.push({ title, src: src.split("#")[0] ?? src });
  });

  return entries;
}

function chapterTitleFromHtml(html: string, fallback: string): string {
  const $ = cheerio.load(html);
  return $("h1,h2,title").first().text().trim() || fallback;
}

function sanitizeChapterHtml(xhtml: string): string {
  const $ = cheerio.load(xhtml);
  const bodyHtml = $("body").html() ?? xhtml;
  return sanitizeHtml(bodyHtml, {
    allowedTags: ["p", "br", "strong", "em", "i", "b", "h1", "h2", "h3", "blockquote"],
    allowedAttributes: {},
    transformTags: {
      h1: "h2"
    }
  });
}

function countWords(html: string): number {
  const text = cheerio.load(html).text();
  const words = text.match(/[\p{L}\p{N}]+/gu);
  return words?.length ?? 0;
}

async function saveCover(zip: AdmZip, opf: ParsedOpf, bookOutputDir: string): Promise<string | null> {
  const coverItem =
    (opf.coverId ? opf.manifest.get(opf.coverId) : null) ??
    [...opf.manifest.values()].find((item) => item.mediaType.startsWith("image/") && item.id.toLowerCase().includes("cover"));

  if (!coverItem) return null;

  const coverPath = normalizeZipPath(opf.baseDir, coverItem.href);
  const entry = zip.getEntry(coverPath);
  if (!entry) return null;

  const extension = path.extname(coverItem.href) || ".jpg";
  const relativePath = path.join(path.basename(bookOutputDir), `cover${extension}`);
  await fs.writeFile(path.join(bookOutputDir, `cover${extension}`), entry.getData());
  return relativePath;
}

export async function importEpubDirectory(input: ImportEpubDirectoryInput): Promise<ImportSummary> {
  await fs.mkdir(input.sourceDir, { recursive: true });
  await fs.mkdir(input.outputDir, { recursive: true });

  const files = (await fs.readdir(input.sourceDir)).filter((file) => file.toLowerCase().endsWith(".epub"));
  const summary: ImportSummary = { importedBooks: 0, importedChapters: 0, skippedFiles: [] };

  for (const file of files) {
    try {
      const sourcePath = path.join(input.sourceDir, file);
      const zip = new AdmZip(sourcePath);
      const opf = parseOpf(zip, findOpfPath(zip));
      const toc = parseToc(zip, opf);
      const bookId = makeBookId(opf.title, file);
      const bookOutputDir = path.join(input.outputDir, bookId);
      const chaptersOutputDir = path.join(bookOutputDir, "chapters");
      await fs.rm(bookOutputDir, { recursive: true, force: true });
      await fs.mkdir(chaptersOutputDir, { recursive: true });

      const importedChapters: Array<{
        id: string;
        number: number;
        title: string;
        contentPath: string;
        wordCount: number;
      }> = [];

      for (const spineItem of opf.spine) {
        if (spineItem.linear?.toLowerCase() === "no") continue;

        const manifestItem = opf.manifest.get(spineItem.idref);
        if (!manifestItem || manifestItem.mediaType !== "application/xhtml+xml") continue;

        const entryPath = normalizeZipPath(opf.baseDir, manifestItem.href);
        const tocEntry = toc.find((entry) => entry.src === manifestItem.href || normalizeZipPath(opf.baseDir, entry.src) === entryPath);
        const xhtml = readZipText(zip, entryPath);
        const fallbackTitle = `Глава ${importedChapters.length + 1}`;
        const title = tocEntry?.title ?? chapterTitleFromHtml(xhtml, fallbackTitle);
        if (shouldSkipChapterTitle(title) || title.trim().toLowerCase() === opf.title.trim().toLowerCase()) continue;

        const sanitizedHtml = sanitizeChapterHtml(xhtml);
        const chapterNumber = importedChapters.length + 1;
        const relativeContentPath = path.join(bookId, "chapters", `${chapterNumber}.html`);
        await fs.writeFile(path.join(input.outputDir, relativeContentPath), sanitizedHtml, "utf8");
        importedChapters.push({
          id: `${bookId}-${chapterNumber}`,
          number: chapterNumber,
          title,
          contentPath: relativeContentPath,
          wordCount: countWords(sanitizedHtml)
        });
      }

      const coverPath = await saveCover(zip, opf, bookOutputDir);
      const chapterCount = importedChapters.length;
      const freeChapterLimit = calculateFreeChapterLimit(chapterCount);

      await input.db.book.upsert({
        where: { id: bookId },
        create: {
          id: bookId,
          title: opf.title,
          author: opf.author,
          description: opf.language ? `Язык: ${opf.language}` : null,
          coverPath,
          chapterCount,
          freeChapterLimit,
          sourceEpubFile: file,
          status: "published"
        },
        update: {
          title: opf.title,
          author: opf.author,
          description: opf.language ? `Язык: ${opf.language}` : null,
          coverPath,
          chapterCount,
          freeChapterLimit,
          sourceEpubFile: file,
          status: "published"
        }
      });

      await input.db.chapter.deleteMany({ where: { bookId } });
      await input.db.chapter.createMany({
        data: importedChapters.map((chapter) => ({
          ...chapter,
          bookId
        }))
      });

      summary.importedBooks += 1;
      summary.importedChapters += importedChapters.length;
    } catch (error) {
      summary.skippedFiles.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return summary;
}
