import { createServer } from "node:net";
import { execFile } from "node:child_process";

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

export async function getPortListeners(port) {
  return new Promise((resolve, reject) => {
    execFile("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-F", "pc"], (error, stdout) => {
      if (error) {
        if (error.code === 1) {
          resolve([]);
          return;
        }
        reject(error);
        return;
      }

      const listeners = [];
      let current = null;
      for (const line of stdout.split(/\r?\n/)) {
        if (!line) continue;
        const type = line[0];
        const value = line.slice(1);
        if (type === "p") {
          current = { pid: Number(value), command: "" };
          listeners.push(current);
        } else if (type === "c" && current) {
          current.command = value;
        }
      }

      resolve(listeners.filter((listener) => Number.isInteger(listener.pid)));
    });
  });
}

export async function killProcess(pid) {
  return new Promise((resolve, reject) => {
    execFile("kill", [String(pid)], (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function getOccupiedDevPorts({ serverPort, miniappPort }, getListeners = getPortListeners, checkPort = isPortInUse) {
  const ports = [
    { label: "server", port: serverPort },
    { label: "Mini App", port: miniappPort }
  ];
  const results = [];

  for (const devPort of ports) {
    const listeners = await getListeners(devPort.port);
    if (listeners.length > 0) {
      results.push({ ...devPort, listeners });
    } else if (await checkPort(devPort.port)) {
      results.push({ ...devPort, listeners: [] });
    }
  }

  return results;
}

export async function stopPortListeners(ports, stopProcess = killProcess) {
  const pids = [...new Set(ports.flatMap(({ listeners = [] }) => listeners.map(({ pid }) => pid)))];
  for (const pid of pids) {
    await stopProcess(pid);
  }
  return pids;
}

export function formatPortConflicts(ports) {
  const list = ports
    .map(({ label, port, listeners = [] }) => {
      const listenerList = listeners.map(({ command, pid }) => `${command || "process"} PID ${pid}`).join(", ");
      return `${label} port ${port}${listenerList ? ` (${listenerList})` : ""}`;
    })
    .join(", ");
  const pids = [...new Set(ports.flatMap(({ listeners = [] }) => listeners.map(({ pid }) => pid)))];
  const killHint = pids.length > 0 ? `\n[dev] To stop these processes: kill ${pids.join(" ")}` : "";
  return `[dev] Cannot start because ${list} ${ports.length === 1 ? "is" : "are"} already in use. Stop the existing process or set PORT/MINIAPP_PORT to free ports.${killHint}`;
}

export function getDevPreparationCommands() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

  return [
    {
      name: "prisma",
      command: "pnpm",
      args: ["--filter", "@novell-reader/server", "exec", "prisma", "db", "push"],
      env: { DATABASE_URL: databaseUrl }
    },
    {
      name: "epub-import",
      command: "pnpm",
      args: ["--filter", "@novell-reader/server", "import:epub"],
      env: { DATABASE_URL: databaseUrl }
    }
  ];
}
