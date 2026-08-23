import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importNovelChadNovel, parseNovelChadNovelPage, renderNovelChadChapterHtml } from "./novelchad.js";

const novelUrl = "https://novelchad.ru/novel/novel-id";

function encodeContent(value: string): string {
  return Buffer.from(encodeURIComponent(value), "utf8").toString("base64");
}

describe("NovelChad import", () => {
  it("parses only free chapter URLs from the novel page", () => {
    const page = `
      <html>
        <head>
          <meta property="og:title" content="Тестовая книга / Test Book" />
          <meta property="og:description" content="Описание книги." />
          <meta property="og:image" content="https://novelchad.ru/images/covers/novel-id.webp" />
          <meta property="article:tag" content="Романтика, Драма, Романтика, 18+, Онгоинг, Ориг:344гл." />
        </head>
        <body>
          <script>
            window.chapters = {
              "2": {"url": "/novel/novel-id/chapters/ch-2", "is_free": true, "date": "02.01.2026"},
              "1": {"url": "/novel/novel-id/chapters/ch-1", "is_free": true, "date": "01.01.2026"},
              "3": {"url": "/novel/novel-id/chapters/ch-3-premium", "is_free": false, "date": "03.01.2026"}
            };
          </script>
        </body>
      </html>`;

    const result = parseNovelChadNovelPage(page, novelUrl);

    expect(result).toEqual({
      id: "novel-id",
      title: "Тестовая книга",
      description: "Описание книги.",
      coverUrl: "https://novelchad.ru/images/covers/novel-id.webp",
      tags: ["Романтика", "Драма"],
      chapters: [
        { number: 1, title: "Глава 1", url: "https://novelchad.ru/novel/novel-id/chapters/ch-1" },
        { number: 2, title: "Глава 2", url: "https://novelchad.ru/novel/novel-id/chapters/ch-2" }
      ]
    });
  });

  it("renders decoded chapter text as sanitized reader HTML", () => {
    const text = "Первый абзац\n\n**Жирный** и *курсив*\n***\n~стих\nстрока~";

    const html = renderNovelChadChapterHtml(text);

    expect(html).toBe("<p>Первый абзац</p>\n<p><strong>Жирный</strong> и <em>курсив</em></p>\n<hr />\n<div class=\"poetry\">стих<br />строка</div>");
  });

  it("imports free chapters into content files and database records", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "novell-reader-novelchad-"));
    const outputDir = path.join(tempDir, "imported");
    const novelPage = `
      <meta property="og:title" content="Тестовая книга / Test Book" />
      <meta property="og:description" content="Описание книги." />
      <script type="application/ld+json">
        {"@context": "https://schema.org", "@type": "Book", "genre": ["Фэнтези", "Драма", "Фэнтези"]}
      </script>
      <script>
        window.chapters = {
          "1": {"url": "/novel/novel-id/chapters/ch-1", "is_free": true},
          "2": {"url": "/novel/novel-id/chapters/ch-2-premium", "is_free": false}
        };
      </script>`;
    const chapterPage = `
      <h1 class="header-title">Глава 1. Начало</h1>
      <div id="chapterContent" class="chapter-content"></div>
      <script>const contentData = '${encodeContent("Текст главы.")}';</script>`;
    const fetchedUrls: string[] = [];
    const fetchHtml = async (url: string) => {
      fetchedUrls.push(url);
      if (url === novelUrl) return novelPage;
      if (url.endsWith("/chapters/ch-1")) return chapterPage;
      throw new Error(`Unexpected URL: ${url}`);
    };
    const createdBooks: unknown[] = [];
    const createdChapters: Array<{ number: number; title: string; contentPath: string; bookId: string }> = [];
    const db = {
      book: {
        upsert: async (input: unknown) => {
          createdBooks.push(input);
          return {};
        }
      },
      chapter: {
        deleteMany: async () => ({}),
        createMany: async ({ data }: { data: Array<{ number: number; title: string; contentPath: string; bookId: string }> }) => {
          createdChapters.push(...data);
          return {};
        }
      }
    };

    const summary = await importNovelChadNovel({ db: db as never, url: novelUrl, outputDir, fetchHtml });

    expect(summary).toEqual({ importedBooks: 1, importedChapters: 1, skippedChapters: [] });
    expect(fetchedUrls).toEqual([novelUrl, "https://novelchad.ru/novel/novel-id/chapters/ch-1"]);
    expect(createdBooks).toHaveLength(1);
    expect(createdBooks[0]).toEqual(
      expect.objectContaining({
        create: expect.objectContaining({ tagsJson: JSON.stringify(["Фэнтези", "Драма"]) }),
        update: expect.objectContaining({ tagsJson: JSON.stringify(["Фэнтези", "Драма"]) })
      })
    );
    expect(createdChapters).toEqual([
      expect.objectContaining({
        bookId: "novelchad-novel-id",
        number: 1,
        title: "Глава 1. Начало",
        contentPath: path.join("novelchad-novel-id", "chapters", "1.html")
      })
    ]);
    await expect(fs.readFile(path.join(outputDir, "novelchad-novel-id", "chapters", "1.html"), "utf8")).resolves.toBe("<p>Текст главы.</p>");
  });
});
