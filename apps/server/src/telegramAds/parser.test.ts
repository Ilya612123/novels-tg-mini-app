import { describe, expect, it } from "vitest";
import { parseTelegramAdsMetrics } from "./parser.js";

describe("Telegram Ads parser", () => {
  it("parses multiple ads from a JSON payload", () => {
    const metrics = parseTelegramAdsMetrics({
      ads: [
        { id: "romance", title: "романтика", views: "1,573", clicks: "42", actions: "9", spent: "12.50" },
        { id: "ranobe", title: "ранобэ", views: 700, clicks: 20, actions: 3, spent: 6 }
      ]
    });

    expect(metrics).toEqual([
      { adKey: "romance", adTitle: "романтика", views: 1573, clicks: 42, actions: 9, spent: 12.5 },
      { adKey: "ranobe", adTitle: "ранобэ", views: 700, clicks: 20, actions: 3, spent: 6 }
    ]);
  });

  it("parses formatted numbers from an HTML table payload", () => {
    const metrics = parseTelegramAdsMetrics(`
      <table>
        <tr><th>Ad</th><th>Views</th><th>Clicks</th><th>Actions</th><th>Spent</th></tr>
        <tr data-ad-key="romance"><td>романтика</td><td>1,573</td><td>42</td><td>9</td><td>€12.50</td></tr>
      </table>
    `);

    expect(metrics).toEqual([
      { adKey: "romance", adTitle: "романтика", views: 1573, clicks: 42, actions: 9, spent: 12.5 }
    ]);
  });

  it("parses Telegram Ads account HTML initial ads list", () => {
    const metrics = parseTelegramAdsMetrics(`
      <script>
        ajInit({"state":{"initialAdsList":{"items":[
          {"ad_id":25,"title":"фанфики","views":1356,"clicks":91,"actions":44,"spent":1.084},
          {"ad_id":24,"title":"ранобэ","views":107,"clicks":11,"actions":5,"spent":0.09}
        ]}}});
      </script>
    `);

    expect(metrics).toEqual([
      { adKey: "25", adTitle: "фанфики", views: 1356, clicks: 91, actions: 44, spent: 1.084 },
      { adKey: "24", adTitle: "ранобэ", views: 107, clicks: 11, actions: 5, spent: 0.09 }
    ]);
  });

  it("throws a clear error when a required field is missing", () => {
    expect(() => parseTelegramAdsMetrics({ ads: [{ id: "romance", title: "романтика", views: 10 }] })).toThrow(
      "Telegram Ads metric is missing clicks"
    );
  });
});
