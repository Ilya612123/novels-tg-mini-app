import path from "node:path";
import { prisma } from "../db.js";
import { importNovelChadNovel } from "./novelchad.js";

const url = process.argv[2];

if (!url) {
  console.error("Usage: pnpm --filter @novell-reader/server import:novelchad <novelchad-url>");
  process.exit(1);
}

const root = process.cwd().endsWith(path.join("apps", "server")) ? path.resolve(process.cwd(), "../..") : process.cwd();

try {
  const summary = await importNovelChadNovel({
    db: prisma,
    url,
    outputDir: path.join(root, "content/imported")
  });

  console.log(`Импортировано книг: ${summary.importedBooks}`);
  console.log(`Импортировано глав: ${summary.importedChapters}`);

  if (summary.skippedChapters.length > 0) {
    console.log(`Пропущено глав: ${summary.skippedChapters.join(", ")}`);
  }
} finally {
  await prisma.$disconnect();
}
