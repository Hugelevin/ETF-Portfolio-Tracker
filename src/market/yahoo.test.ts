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

  it("accepts a daily mutual-fund NAV while preserving the configured identity", () => {
    const fund: Instrument = {
      ...instrument,
      id: "ummepsa-nav-eur",
      name: "UBS EUR Money Market Fund",
      ticker: "UMMEPSA",
      isin: "IE00BWWCR731",
      exchange: "Daily fund NAV",
      assetType: "FUND",
      yahooSymbol: "0P0001CD0Q.F",
    };
    const fundPayload = structuredClone(payload);
    fundPayload.chart.result[0]!.meta = {
      ...fundPayload.chart.result[0]!.meta,
      symbol: fund.yahooSymbol,
      fullExchangeName: "Frankfurt",
      instrumentType: "MUTUALFUND",
    };
    expect(parseYahooChart(fund, fundPayload).quote.price).toBe(80);
  });
});
