import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { extractChapterNumber, importEpubDirectory, shouldSkipChapterTitle } from "./epub.js";

describe("EPUB import helpers", () => {
  it("keeps real chapters and skips service pages", () => {
    expect(shouldSkipChapterTitle("Глава 51. Экстра")).toBe(false);
    expect(shouldSkipChapterTitle("Информация о книге")).toBe(true);
  });

  it("extracts chapter numbers from titles", () => {
    expect(extractChapterNumber("Глава 17")).toBe(17);
    expect(extractChapterNumber("Глава 51. Экстра")).toBe(51);
  });

  it("imports EPUB files with root-level OPF and NCX files", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "novell-reader-epub-"));
    const sourceDir = path.join(tempDir, "epub");
    const outputDir = path.join(tempDir, "imported");
    await fs.mkdir(sourceDir, { recursive: true });

    const zip = new AdmZip();
    zip.addFile("META-INF/container.xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="book.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`));
    zip.addFile("book.opf", Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Корневой EPUB</dc:title>
    <dc:language>ru</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="book.ncx" media-type="application/x-dtbncx+xml" />
    <item id="chapter1" href="Chapter1.html" media-type="application/xhtml+xml" />
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter1" />
  </spine>
</package>`));
    zip.addFile("book.ncx", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    <navPoint id="chapter1" playOrder="1">
      <navLabel><text>Глава 1</text></navLabel>
      <content src="Chapter1.html" />
    </navPoint>
  </navMap>
</ncx>`));
    zip.addFile("Chapter1.html", Buffer.from("<html><body><h1>Глава 1</h1><p>Текст главы.</p></body></html>"));
    await zip.writeZipPromise(path.join(sourceDir, "root-level.epub"));

    const createdChapters: unknown[] = [];
    const db = {
      book: {
        upsert: async () => ({})
      },
      chapter: {
        deleteMany: async () => ({}),
        createMany: async ({ data }: { data: unknown[] }) => {
          createdChapters.push(...data);
          return {};
        }
      }
    };

    const summary = await importEpubDirectory({ db: db as never, sourceDir, outputDir });

    expect(summary).toEqual({ importedBooks: 1, importedChapters: 1, skippedFiles: [] });
    expect(createdChapters).toHaveLength(1);
  });

  it("skips root-level cover and book header pages before numbered chapters", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "novell-reader-epub-"));
    const sourceDir = path.join(tempDir, "epub");
    const outputDir = path.join(tempDir, "imported");
    await fs.mkdir(sourceDir, { recursive: true });

    const zip = new AdmZip();
    zip.addFile("META-INF/container.xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="book.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`));
    zip.addFile("book.opf", Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Книга с обложкой</dc:title>
    <dc:language>ru</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="book.ncx" media-type="application/x-dtbncx+xml" />
    <item id="coverPage" href="CoverPage.html" media-type="application/xhtml+xml" />
    <item id="header" href="Header.html" media-type="application/xhtml+xml" />
    <item id="chapter1" href="Chapter1.html" media-type="application/xhtml+xml" />
  </manifest>
  <spine toc="ncx">
    <itemref idref="coverPage" linear="no" />
    <itemref idref="header" />
    <itemref idref="chapter1" />
  </spine>
</package>`));
    zip.addFile("book.ncx", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    <navPoint id="cover" playOrder="0">
      <navLabel><text>Cover</text></navLabel>
      <content src="CoverPage.html" />
    </navPoint>
    <navPoint id="header" playOrder="1">
      <navLabel><text>Книга с обложкой</text></navLabel>
      <content src="Header.html" />
    </navPoint>
    <navPoint id="chapter1" playOrder="2">
      <navLabel><text>Глава 1. Начало</text></navLabel>
      <content src="Chapter1.html" />
    </navPoint>
  </navMap>
</ncx>`));
    zip.addFile("CoverPage.html", Buffer.from("<html><body><h1>Cover</h1></body></html>"));
    zip.addFile("Header.html", Buffer.from("<html><body><h1>Книга с обложкой</h1><p>Описание книги.</p></body></html>"));
    zip.addFile("Chapter1.html", Buffer.from("<html><body><h1>Глава 1. Начало</h1><p>Текст главы.</p></body></html>"));
    await zip.writeZipPromise(path.join(sourceDir, "cover-and-header.epub"));

    const createdChapters: Array<{ number: number; title: string }> = [];
    const db = {
      book: {
        upsert: async () => ({})
      },
      chapter: {
        deleteMany: async () => ({}),
        createMany: async ({ data }: { data: Array<{ number: number; title: string }> }) => {
          createdChapters.push(...data);
          return {};
        }
      }
    };

    const summary = await importEpubDirectory({ db: db as never, sourceDir, outputDir });

    expect(summary).toEqual({ importedBooks: 1, importedChapters: 1, skippedFiles: [] });
    expect(createdChapters).toEqual([expect.objectContaining({ number: 1, title: "Глава 1. Начало" })]);
  });

  it("stores imported chapters with sequential numbers when source titles repeat", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "novell-reader-epub-"));
    const sourceDir = path.join(tempDir, "epub");
    const outputDir = path.join(tempDir, "imported");
    await fs.mkdir(sourceDir, { recursive: true });

    const zip = new AdmZip();
    zip.addFile("META-INF/container.xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="book.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`));
    zip.addFile("book.opf", Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Повтор глав</dc:title>
    <dc:language>ru</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="book.ncx" media-type="application/x-dtbncx+xml" />
    <item id="chapter1" href="Chapter1.html" media-type="application/xhtml+xml" />
    <item id="chapter2" href="Chapter2.html" media-type="application/xhtml+xml" />
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter1" />
    <itemref idref="chapter2" />
  </spine>
</package>`));
    zip.addFile("book.ncx", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    <navPoint id="chapter1" playOrder="1">
      <navLabel><text>Глава 479. Предложение</text></navLabel>
      <content src="Chapter1.html" />
    </navPoint>
    <navPoint id="chapter2" playOrder="2">
      <navLabel><text>Глава 479. Предложение</text></navLabel>
      <content src="Chapter2.html" />
    </navPoint>
  </navMap>
</ncx>`));
    zip.addFile("Chapter1.html", Buffer.from("<html><body><h1>Глава 479. Предложение</h1><p>Первый текст.</p></body></html>"));
    zip.addFile("Chapter2.html", Buffer.from("<html><body><h1>Глава 479. Предложение</h1><p>Второй текст.</p></body></html>"));
    await zip.writeZipPromise(path.join(sourceDir, "repeated-source-titles.epub"));

    const createdChapters: Array<{ number: number; title: string }> = [];
    const db = {
      book: {
        upsert: async () => ({})
      },
      chapter: {
        deleteMany: async () => ({}),
        createMany: async ({ data }: { data: Array<{ number: number; title: string }> }) => {
          createdChapters.push(...data);
          return {};
        }
      }
    };

    const summary = await importEpubDirectory({ db: db as never, sourceDir, outputDir });

    expect(summary).toEqual({ importedBooks: 1, importedChapters: 2, skippedFiles: [] });
    expect(createdChapters.map((chapter) => chapter.number)).toEqual([1, 2]);
  });
});
