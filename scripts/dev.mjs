import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const SERVER_PORT = Number(process.env.PORT ?? 3000);
const MINIAPP_PORT = Number(process.env.MINIAPP_PORT ?? 5173);
const SERVER_ORIGIN = `http://localhost:${SERVER_PORT}`;
const MINIAPP_ORIGIN = `http://localhost:${MINIAPP_PORT}`;

const children = new Set();
let tunnelUrl = null;
let shuttingDown = false;

function loadDotEnv() {
  if (!existsSync(".env")) return;
  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function spawnProcess(name, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...options.env },
    shell: false
  });
  children.add(child);

  child.stdout.on("data", (chunk) => handleOutput(name, chunk));
  child.stderr.on("data", (chunk) => handleOutput(name, chunk));
  child.on("error", (error) => {
    children.delete(child);
    console.error(`[${name}] failed to start: ${error.message}`);
    if (name === "cloudflared") {
      console.error("[dev] Install cloudflared first: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/");
    }
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown && code !== 0) {
      console.error(`[${name}] exited with code ${code ?? "null"} signal ${signal ?? "null"}`);
      shutdown(1);
    }
  });

  return child;
}

function handleOutput(name, chunk) {
  const text = chunk.toString();
  process.stdout.write(`[${name}] ${text}`);

  if (name === "cloudflared" && !tunnelUrl) {
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
      tunnelUrl = match[0];
      setupWebhook(tunnelUrl).catch((error) => {
        console.error(`[dev] webhook setup failed: ${error instanceof Error ? error.message : String(error)}`);
        shutdown(1);
      });
    }
  }
}

async function waitFor(url, label) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

async function setupWebhook(publicUrl) {
  await waitFor(`${SERVER_ORIGIN}/health`, "server");
  const response = await fetch(`${SERVER_ORIGIN}/dev/setup-webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publicUrl })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const result = await response.json();
  console.log(`[dev] Mini App URL: ${result.miniAppUrl}`);
  console.log(`[dev] Telegram webhook: ${result.webhookUrl}`);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

loadDotEnv();

if (!process.env.BOT_TOKEN) {
  console.error("[dev] BOT_TOKEN is required. Create .env or export BOT_TOKEN before running pnpm dev.");
  process.exit(1);
}

console.log("[dev] starting server, mini app and Cloudflare tunnel");

spawnProcess("server", "pnpm", ["dev:server"], {
  env: {
    BOT_MODE: "webhook",
    PORT: String(SERVER_PORT),
    MINI_APP_URL: MINIAPP_ORIGIN,
    PUBLIC_BASE_URL: MINIAPP_ORIGIN
  }
});

spawnProcess("miniapp", "pnpm", ["dev:miniapp"], {
  env: {
    VITE_API_BASE_URL: ""
  }
});

await waitFor(`${MINIAPP_ORIGIN}`, "miniapp");

spawnProcess("cloudflared", "cloudflared", ["tunnel", "--url", MINIAPP_ORIGIN, "--no-autoupdate"]);
