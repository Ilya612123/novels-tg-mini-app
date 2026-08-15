import { describe, expect, it } from "vitest";
import { DEFAULT_DATABASE_URL, loadConfig } from "./config.js";

const requiredEnv = {
  BOT_TOKEN: "token",
  ANALYTICS_USER_ID: "5100586818",
  STARS_ACCESS_PRICE: "100"
};

describe("loadConfig", () => {
  it("uses local defaults for Docker-friendly startup", () => {
    const env: Record<string, string | undefined> = { ...requiredEnv };

    expect(loadConfig(env)).toMatchObject({
      DATABASE_URL: DEFAULT_DATABASE_URL,
      MINI_APP_URL: "http://localhost:3000",
      PORT: 3000,
      BOT_MODE: "webhook"
    });
    expect(env.DATABASE_URL).toBe(DEFAULT_DATABASE_URL);
  });

  it("derives Mini App URL from the public server URL", () => {
    expect(loadConfig({ ...requiredEnv, PUBLIC_BASE_URL: "https://reader.example.com" }).MINI_APP_URL).toBe(
      "https://reader.example.com"
    );
  });

  it("ignores blank optional environment values from .env files", () => {
    const env = loadConfig({
      ...requiredEnv,
      PUBLIC_BASE_URL: "",
      MINI_APP_URL: "",
      MINI_APP_DIST_DIR: ""
    });

    expect(env.MINI_APP_URL).toBe("http://localhost:3000");
    expect(env.PUBLIC_BASE_URL).toBeUndefined();
    expect(env.MINI_APP_DIST_DIR).toBeUndefined();
  });
});
