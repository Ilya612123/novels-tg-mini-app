import path from "node:path";
import { prisma } from "../db.js";
import { importEpubDirectory } from "./epub.js";

const root = process.cwd().endsWith(path.join("apps", "server")) ? path.resolve(process.cwd(), "../..") : process.cwd();

const summary = await importEpubDirectory({
  db: prisma,
  sourceDir: path.join(root, "content/epub"),
  outputDir: path.join(root, "content/imported"),
  descriptionsFile: path.join(root, "content/book-descriptions.json")
});

console.log(`Импортировано книг: ${summary.importedBooks}`);
console.log(`Импортировано глав: ${summary.importedChapters}`);

if (summary.skippedFiles.length > 0) {
  console.log(`Пропущено файлов: ${summary.skippedFiles.join(", ")}`);
}

await prisma.$disconnect();
