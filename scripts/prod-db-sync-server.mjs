import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(rootDir, ".prod-db-sync.env");
const statusFile = path.join(rootDir, "local-db-dumps", "prod-db-sync-status.json");
const scriptPath = path.join(rootDir, "scripts", "sync-prod-db.sh");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  const parsed = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    parsed[key] = value;
  }
  return parsed;
}

const fileEnv = parseEnvFile(envFile);
const port = Number(process.env.PROD_DB_SYNC_PORT ?? fileEnv.PROD_DB_SYNC_PORT ?? 4321);
const host = process.env.PROD_DB_SYNC_BIND_HOST ?? "127.0.0.1";
const outputPath = path.resolve(rootDir, process.env.PROD_DB_SYNC_OUTPUT ?? fileEnv.PROD_DB_SYNC_OUTPUT ?? "local-db-dumps/prod.db");

let currentRun = null;

async function readStatus() {
  let saved = {};
  try {
    saved = JSON.parse(await fs.readFile(statusFile, "utf8"));
  } catch {
    saved = {};
  }

  let database = {
    exists: false,
    path: outputPath,
    sizeBytes: 0,
    modifiedAt: null
  };

  try {
    const stat = await fs.stat(outputPath);
    database = {
      exists: true,
      path: outputPath,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString()
    };
  } catch {
    // No local copy yet.
  }

  return {
    ...saved,
    database,
    running: Boolean(currentRun)
  };
}

async function writeStatus(status) {
  await fs.mkdir(path.dirname(statusFile), { recursive: true });
  await fs.writeFile(statusFile, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

function runSync() {
  if (currentRun) {
    return currentRun;
  }

  currentRun = new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const child = spawn("bash", [scriptPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        ...fileEnv
      }
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });

    child.on("close", async (code) => {
      const finishedAt = new Date().toISOString();
      const trimmedOutput = output.trim();
      const lastOutputLine = trimmedOutput.split(/\r?\n/).at(-1) ?? "";
      const status = {
        lastRun: {
          startedAt,
          finishedAt,
          ok: code === 0,
          exitCode: code,
          output: output.slice(-4000)
        }
      };
      await writeStatus(status);
      console.log(`Prod DB sync ${code === 0 ? "finished" : "failed"} at ${finishedAt} with exit code ${code}.`);
      if (lastOutputLine) {
        console.log(lastOutputLine);
      }
      currentRun = null;
      resolve(status);
    });
  });

  return currentRun;
}

function json(res, statusCode, data) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(`${JSON.stringify(data, null, 2)}\n`);
}

function htmlPage(status) {
  const db = status.database;
  const lastRun = status.lastRun;
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prod DB Sync</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #1f2328; }
    main { max-width: 760px; }
    button { min-height: 40px; padding: 0 16px; border: 1px solid #1f2328; border-radius: 6px; background: #1f2328; color: white; cursor: pointer; }
    button:disabled { opacity: .55; cursor: wait; }
    dl { display: grid; grid-template-columns: 180px 1fr; gap: 8px 16px; }
    dt { color: #59636e; }
    dd { margin: 0; overflow-wrap: anywhere; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }
  </style>
</head>
<body>
  <main>
    <h1>Prod DB Sync</h1>
    <form method="post" action="/sync">
      <button ${status.running ? "disabled" : ""}>${status.running ? "Синхронизация..." : "Скачать продовую базу"}</button>
    </form>
    <dl>
      <dt>Локальная база</dt><dd>${db.exists ? "есть" : "пока нет"}</dd>
      <dt>Путь</dt><dd>${db.path}</dd>
      <dt>Размер</dt><dd>${db.sizeBytes} bytes</dd>
      <dt>Обновлена</dt><dd>${db.modifiedAt ?? "-"}</dd>
      <dt>Последний запуск</dt><dd>${lastRun?.finishedAt ?? "-"}</dd>
      <dt>Статус</dt><dd>${lastRun ? (lastRun.ok ? "ok" : `error ${lastRun.exitCode}`) : "-"}</dd>
    </dl>
    <pre>${escapeHtml(lastRun?.output ?? "")}</pre>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/status") {
      json(res, 200, await readStatus());
      return;
    }

    if (req.method === "POST" && req.url === "/api/sync") {
      const alreadyRunning = Boolean(currentRun);
      const status = await runSync();
      json(res, alreadyRunning ? 202 : 200, status);
      return;
    }

    if (req.method === "POST" && req.url === "/sync") {
      runSync();
      res.writeHead(303, { location: "/" });
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(htmlPage(await readStatus()));
      return;
    }

    json(res, 404, { error: "not_found" });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, host, () => {
  console.log(`Prod DB Sync server: http://${host}:${port}`);
  console.log("Starting initial prod DB sync...");
  runSync();
});
