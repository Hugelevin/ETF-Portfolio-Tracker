import { describe, expect, it } from "vitest";
import { VERIFIED_INSTRUMENTS } from "../config/instruments";
import { marketDataSourceInstrument } from "./marketDataSource";
import { instrumentIdentity, isValidMarketRecord } from "./service";
import { parseYahooChart } from "./yahoo";

describe("approved market data source", () => {
  const instrument = VERIFIED_INSTRUMENTS[0]!;
  it("requires the verified ISIN, currency, type and Milan listing", () => {
    expect(marketDataSourceInstrument(instrument)).toMatchObject({ isin: instrument.isin, currency: "EUR", yahooSymbol: "ANAV.DE", exchange: "Xetra" });
    for (const changed of [{ isin: "OTHER" }, { currency: "USD" }, { assetType: "FUND" as const }, { exchange: "Stuttgart" }, { micCode: "XETR" }, { yahooSymbol: "IE000QDFFK00.SG" }]) {
      const other = { ...instrument, ...changed };
      expect(marketDataSourceInstrument(other)).toBe(other);
    }
  });
  it("invalidates old Milan quote/history caches", () => {
    const record = parseYahooChart(instrument, { chart: { result: [{
      meta: { symbol: instrument.yahooSymbol, currency: "EUR", fullExchangeName: "Milan", instrumentType: "ETF" },
      timestamp: [1785754800], indicators: { quote: [{ close: [23] }] },
    }] } });
    const oldIdentity = JSON.stringify(["market-v2", instrument.isin, "XMIL", "EUR", "ETF", instrument.yahooSymbol]);
    expect(instrumentIdentity(instrument)).not.toBe(oldIdentity);
    expect(isValidMarketRecord({ ...record, identity: oldIdentity }, instrument)).toBe(false);
  });
});
