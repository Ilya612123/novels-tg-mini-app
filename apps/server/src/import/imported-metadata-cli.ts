import path from "node:path";
import { prisma } from "../db.js";
import { importImportedMetadata } from "./importedMetadata.js";

const root = process.cwd().endsWith(path.join("apps", "server")) ? path.resolve(process.cwd(), "../..") : process.cwd();

try {
  const summary = await importImportedMetadata({
    db: prisma,
    metadataFile: path.join(root, "content/imported/novelchad-metadata.json"),
    outputDir: path.join(root, "content/imported")
  });

  console.log(`Импортировано книг: ${summary.importedBooks}`);
  console.log(`Импортировано глав: ${summary.importedChapters}`);

  if (summary.skippedBooks.length > 0) {
    console.log(`Пропущено книг: ${summary.skippedBooks.join(", ")}`);
  }
} finally {
  await prisma.$disconnect();
}
