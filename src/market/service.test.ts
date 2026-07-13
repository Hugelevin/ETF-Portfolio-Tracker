import { describe, expect, it, vi } from "vitest";
import type { Instrument, ManualPrice, MarketRecord } from "../types";
import { resolveMarketData } from "./service";

const instrument: Instrument = {
  id: "jedi-xetra-eur",
  name: "VanEck Space Innovators UCITS ETF",
  ticker: "JEDI",
  isin: "IE000YU9K6K2",
  exchange: "Xetra",
  currency: "EUR",
  assetType: "ETF",
  yahooSymbol: "JEDI.DE",
};

const record = (source: MarketRecord["quote"]["source"]): MarketRecord => ({
  quote: {
    instrumentId: instrument.id,
    price: 80,
    previousClose: 79,
    currency: "EUR",
    exchange: "Xetra",
    asOf: "2026-07-13T10:00:00.000Z",
    fetchedAt: "2026-07-13T10:01:00.000Z",
    source,
    label: source,
    stale: false,
  },
  history: [{ timestamp: "2026-07-13T10:00:00.000Z", close: 80 }],
});

describe("resolveMarketData", () => {
  it("prefers a successful Yahoo response", async () => {
    const yahoo = vi.fn().mockResolvedValue(record("yahoo"));
    const result = await resolveMarketData({ instrument, yahoo, cached: record("cache") });
    expect(result.record?.quote.source).toBe("yahoo");
    expect(result.status).toBe("available");
  });

  it("falls back through cache, manual and unavailable in that order", async () => {
    const failed = vi.fn().mockRejectedValue(new Error("offline"));
    const cached = await resolveMarketData({ instrument, yahoo: failed, cached: record("cache") });
    expect(cached.record?.quote.source).toBe("cache");

    const manual: ManualPrice = { instrumentId: instrument.id, price: 77, asOf: "2026-07-12" };
    const manualResult = await resolveMarketData({ instrument, yahoo: failed, manual });
    expect(manualResult.record?.quote.source).toBe("manual");
    expect(manualResult.record?.quote.previousClose).toBeNull();

    const fundResult = await resolveMarketData({
      instrument: { ...instrument, assetType: "FUND", exchange: "Daily fund NAV" },
      yahoo: failed,
      manual,
    });
    expect(fundResult.record?.quote.label).toBe("Manual NAV");

    const missing = await resolveMarketData({ instrument, yahoo: failed });
    expect(missing.record).toBeNull();
    expect(missing.status).toBe("unavailable");
  });
});
