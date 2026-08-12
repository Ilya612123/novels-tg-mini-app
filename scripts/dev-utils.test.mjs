import assert from "node:assert/strict";
import { test } from "node:test";
import { getDevPreparationCommands, getOccupiedDevPorts } from "./dev-utils.mjs";

test("getOccupiedDevPorts reports occupied dev ports", async () => {
  const occupiedPorts = await getOccupiedDevPorts(
    { serverPort: 3000, miniappPort: 5173 },
    async (port) => port === 5173
  );

  assert.deepEqual(occupiedPorts, [{ label: "Mini App", port: 5173 }]);
});

test("getOccupiedDevPorts returns no conflicts when dev ports are available", async () => {
  const occupiedPorts = await getOccupiedDevPorts({ serverPort: 3000, miniappPort: 5173 }, async () => false);

  assert.deepEqual(occupiedPorts, []);
});

test("getDevPreparationCommands syncs the local Prisma database and imports EPUB before startup", () => {
  assert.deepEqual(getDevPreparationCommands(), [
    {
      name: "prisma",
      command: "pnpm",
      args: ["--filter", "@novell-reader/server", "exec", "prisma", "db", "push"],
      env: { DATABASE_URL: "file:./dev.db" }
    },
    {
      name: "epub-import",
      command: "pnpm",
      args: ["--filter", "@novell-reader/server", "import:epub"],
      env: { DATABASE_URL: "file:./dev.db" }
    }
  ]);
});
