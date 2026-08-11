import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateTelegramInitData } from "./auth.js";

function signedInitData(botToken: string, entries: Record<string, string>): string {
  const params = new URLSearchParams(entries);
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("validateTelegramInitData", () => {
  it("returns Telegram user for valid signed init data", () => {
    const initData = signedInitData("bot-token", {
      auth_date: "1780000000",
      query_id: "query",
      user: JSON.stringify({ id: 5100586818, username: "barboruss", first_name: "Анна" })
    });

    expect(validateTelegramInitData(initData, "bot-token")).toEqual({
      id: "5100586818",
      username: "barboruss",
      firstName: "Анна",
      lastName: null
    });
  });

  it("rejects invalid hash", () => {
    const initData = signedInitData("bot-token", {
      auth_date: "1780000000",
      user: JSON.stringify({ id: 5100586818 })
    }).replace(/.$/, "0");

    expect(validateTelegramInitData(initData, "bot-token")).toBeNull();
  });
});
