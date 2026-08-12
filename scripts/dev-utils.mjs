import { createServer } from "node:net";

export async function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(true);
        return;
      }
      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(false));
    });

    server.listen(port, "127.0.0.1");
  });
}

export async function getOccupiedDevPorts({ serverPort, miniappPort }, checkPort = isPortInUse) {
  const ports = [
    { label: "server", port: serverPort },
    { label: "Mini App", port: miniappPort }
  ];
  const results = [];

  for (const devPort of ports) {
    if (await checkPort(devPort.port)) {
      results.push(devPort);
    }
  }

  return results;
}

export function formatPortConflicts(ports) {
  const list = ports.map(({ label, port }) => `${label} port ${port}`).join(", ");
  return `[dev] Cannot start because ${list} ${ports.length === 1 ? "is" : "are"} already in use. Stop the existing process or set PORT/MINIAPP_PORT to free ports.`;
}

export function getDevPreparationCommands() {
  return [
    {
      name: "prisma",
      command: "pnpm",
      args: ["--filter", "@novell-reader/server", "exec", "prisma", "db", "push"],
      env: { DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db" }
    }
  ];
}
