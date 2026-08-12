import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPortConflicts, getDevPreparationCommands, getOccupiedDevPorts, stopPortListeners } from "./dev-utils.mjs";

test("getOccupiedDevPorts reports occupied dev ports", async () => {
  const occupiedPorts = await getOccupiedDevPorts(
    { serverPort: 3000, miniappPort: 5173 },
    async () => [],
    async (port) => port === 5173
  );

  assert.deepEqual(occupiedPorts, [{ label: "Mini App", port: 5173, listeners: [] }]);
});

test("getOccupiedDevPorts includes listener PIDs when lsof finds occupied dev ports", async () => {
  const occupiedPorts = await getOccupiedDevPorts(
    { serverPort: 3000, miniappPort: 5173 },
    async (port) => (port === 3000 ? [{ command: "node", pid: 6468 }] : []),
    async () => false
  );

  assert.deepEqual(occupiedPorts, [{ label: "server", port: 3000, listeners: [{ command: "node", pid: 6468 }] }]);
});

test("getOccupiedDevPorts returns no conflicts when dev ports are available", async () => {
  const occupiedPorts = await getOccupiedDevPorts({ serverPort: 3000, miniappPort: 5173 }, async () => [], async () => false);

  assert.deepEqual(occupiedPorts, []);
});

test("formatPortConflicts suggests kill commands for known listener PIDs", () => {
  const message = formatPortConflicts([
    { label: "server", port: 3000, listeners: [{ command: "node", pid: 6468 }] },
    { label: "Mini App", port: 5173, listeners: [{ command: "node", pid: 3034 }] }
  ]);

  assert.equal(
    message,
    "[dev] Cannot start because server port 3000 (node PID 6468), Mini App port 5173 (node PID 3034) are already in use. Stop the existing process or set PORT/MINIAPP_PORT to free ports.\n[dev] To stop these processes: kill 6468 3034"
  );
});

test("stopPortListeners sends SIGTERM once for each unique listener PID", async () => {
  const killedPids = [];
  const stoppedPids = await stopPortListeners(
    [
      { label: "server", port: 3000, listeners: [{ command: "node", pid: 6468 }] },
      { label: "Mini App", port: 5173, listeners: [{ command: "node", pid: 6468 }, { command: "node", pid: 3034 }] }
    ],
    async (pid) => {
      killedPids.push(pid);
    }
  );

  assert.deepEqual(stoppedPids, [6468, 3034]);
  assert.deepEqual(killedPids, [6468, 3034]);
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
