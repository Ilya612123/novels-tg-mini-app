import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import sharp from "sharp";
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

  it("uses configured book descriptions instead of language placeholders", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "novell-reader-epub-"));
    const sourceDir = path.join(tempDir, "epub");
    const outputDir = path.join(tempDir, "imported");
    const descriptionsFile = path.join(tempDir, "book-descriptions.json");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(
      descriptionsFile,
      JSON.stringify({
        "kniga-s-opisaniem": "Опасное притяжение, запретная близость и герой, который не привык отпускать свое."
      }),
      "utf8"
    );

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
    <dc:title>Книга с описанием</dc:title>
    <dc:language>ru</dc:language>
  </metadata>
  <manifest>
    <item id="chapter1" href="Chapter1.html" media-type="application/xhtml+xml" />
  </manifest>
  <spine>
    <itemref idref="chapter1" />
  </spine>
</package>`));
    zip.addFile("Chapter1.html", Buffer.from("<html><body><h1>Глава 1</h1><p>Текст главы.</p></body></html>"));
    await zip.writeZipPromise(path.join(sourceDir, "described.epub"));

    const upsertInputs: Array<{ create: { description: string | null }; update: { description: string | null } }> = [];
    const db = {
      book: {
        upsert: async (input: { create: { description: string | null }; update: { description: string | null } }) => {
          upsertInputs.push(input);
          return {};
        }
      },
      chapter: {
        deleteMany: async () => ({}),
        createMany: async () => ({})
      }
    };

    await importEpubDirectory({ db: db as never, sourceDir, outputDir, descriptionsFile });

    const upsertInput = upsertInputs[0];
    expect(upsertInput?.create.description).toBe(
      "Опасное притяжение, запретная близость и герой, который не привык отпускать свое."
    );
    expect(upsertInput?.update.description).toBe(
      "Опасное притяжение, запретная близость и герой, который не привык отпускать свое."
    );
  });

  it("converts imported PNG covers to WebP files and stores the optimized cover path", async () => {
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
    <dc:title>Web Cover</dc:title>
    <dc:language>ru</dc:language>
    <meta name="cover" content="cover-image" />
  </metadata>
  <manifest>
    <item id="cover-image" href="cover.png" media-type="image/png" />
    <item id="chapter1" href="Chapter1.html" media-type="application/xhtml+xml" />
  </manifest>
  <spine>
    <itemref idref="chapter1" />
  </spine>
</package>`));
    const coverPng = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: "#f43f5e"
      }
    })
      .png()
      .toBuffer();
    zip.addFile("cover.png", coverPng);
    zip.addFile("Chapter1.html", Buffer.from("<html><body><h1>Глава 1</h1><p>Текст главы.</p></body></html>"));
    await zip.writeZipPromise(path.join(sourceDir, "web-cover.epub"));

    const upsertInputs: Array<{ create: { coverPath: string | null }; update: { coverPath: string | null } }> = [];
    const db = {
      book: {
        upsert: async (input: { create: { coverPath: string | null }; update: { coverPath: string | null } }) => {
          upsertInputs.push(input);
          return {};
        }
      },
      chapter: {
        deleteMany: async () => ({}),
        createMany: async () => ({})
      }
    };

    const summary = await importEpubDirectory({ db: db as never, sourceDir, outputDir });

    expect(summary).toEqual({ importedBooks: 1, importedChapters: 1, skippedFiles: [] });
    expect(upsertInputs[0]?.create.coverPath).toBe(path.join("web-cover", "cover.webp"));
    expect(upsertInputs[0]?.update.coverPath).toBe(path.join("web-cover", "cover.webp"));
    await expect(fs.access(path.join(outputDir, "web-cover", "cover.png"))).rejects.toThrow();

    const cover = await fs.readFile(path.join(outputDir, "web-cover", "cover.webp"));
    expect(cover.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(cover.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });
});
