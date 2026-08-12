// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "./vite.config";

describe("Vite dev server config", () => {
  it("allows Cloudflare quick tunnel hosts for Telegram webhooks", () => {
    expect(config.server?.allowedHosts).toContain(".trycloudflare.com");
  });
});

describe("Mini App document", () => {
  it("loads Telegram Web App SDK before the application script", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

    const telegramSdkIndex = html.indexOf("https://telegram.org/js/telegram-web-app.js");
    const appScriptIndex = html.indexOf("/src/main.tsx");

    expect(telegramSdkIndex).toBeGreaterThan(-1);
    expect(telegramSdkIndex).toBeLessThan(appScriptIndex);
  });
});
