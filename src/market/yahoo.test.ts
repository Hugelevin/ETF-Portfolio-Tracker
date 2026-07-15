import { describe, expect, it } from "vitest";
import { parseYahooChart } from "./yahoo";
import type { Instrument } from "../types";

const instrument: Instrument = {
  id: "jedi-xetra-eur",
  name: "VanEck Space Innovators UCITS ETF",
  ticker: "JEDI",
  isin: "IE000YU9K6K2",
  exchange: "Xetra",
  micCode: "XETR",
  currency: "EUR",
  assetType: "ETF",
  yahooSymbol: "JEDI.DE",
};

const payload = {
  chart: {
    error: null,
    result: [{
      meta: {
        symbol: "JEDI.DE",
        currency: "EUR",
        fullExchangeName: "XETRA",
        instrumentType: "ETF",
        chartPreviousClose: 79,
        regularMarketPreviousClose: 79,
      },
      timestamp: [1_783_930_000, 1_783_930_300, 1_783_930_600],
      indicators: {
        quote: [{ close: [79.2, null, 80] }],
      },
    }],
  },
};

describe("parseYahooChart", () => {
  it("uses the latest non-null timestamped point", () => {
    const record = parseYahooChart(
      instrument,
      payload,
      "2026-07-13T10:05:00.000Z",
    );

    expect(record.quote.price).toBe(80);
    expect(record.quote.previousClose).toBe(79);
    expect(record.quote.currency).toBe("EUR");
    expect(record.quote.exchange).toBe("XETRA");
    expect(record.history).toHaveLength(2);
  });

  it("uses the previous trading day's timestamped close instead of the range baseline", () => {
    const changed = structuredClone(payload);
    changed.chart.result[0]!.meta = {
      ...changed.chart.result[0]!.meta,
      chartPreviousClose: 60,
      regularMarketPreviousClose: 79.2,
    };
    changed.chart.result[0]!.timestamp = [
      Math.floor(Date.parse("2026-07-10T15:30:00Z") / 1_000),
      Math.floor(Date.parse("2026-07-13T08:00:00Z") / 1_000),
      Math.floor(Date.parse("2026-07-13T10:00:00Z") / 1_000),
    ];
    changed.chart.result[0]!.indicators.quote[0]!.close = [79.2, 79.8, 80];

    const record = parseYahooChart(instrument, changed, "2026-07-13T10:05:00.000Z");

    expect(record.quote.previousClose).toBe(79.2);
  });

  it("derives market session and quote delay from Yahoo metadata", () => {
    const changed = structuredClone(payload);
    changed.chart.result[0]!.meta = {
      ...changed.chart.result[0]!.meta,
      currentTradingPeriod: { regular: { start: 1_783_929_600, end: 1_783_958_400 } },
    } as typeof changed.chart.result[0]["meta"];

    const record = parseYahooChart(instrument, changed, "2026-07-13T08:18:40.000Z");

    expect(record.quote).toMatchObject({ marketSession: "open", delayMinutes: 2 });
  });

  it.each([
    ["symbol", "JEDI.MI", "symbol"],
    ["currency", "USD", "currency"],
    ["fullExchangeName", "MILAN", "exchange"],
  ])("rejects a mismatched %s", (field, value, message) => {
    const changed = structuredClone(payload);
    changed.chart.result[0]!.meta = {
      ...changed.chart.result[0]!.meta,
      [field]: value,
    };
    expect(() => parseYahooChart(instrument, changed)).toThrow(message);
  });

  it("rejects empty or unusable data points", () => {
    const changed = structuredClone(payload);
    changed.chart.result[0]!.indicators.quote[0]!.close = [null, null, null];
    expect(() => parseYahooChart(instrument, changed)).toThrow("no valid timestamped prices");
  });

});
