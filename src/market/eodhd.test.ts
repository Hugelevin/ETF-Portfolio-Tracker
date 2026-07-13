import { describe, expect, it } from "vitest";
import type { Instrument } from "../types";
import { parseEodhdHistory } from "./eodhd";

const instrument: Instrument = {
  id: "vwce-xetra-eur",
  name: "Vanguard FTSE All-World UCITS ETF",
  ticker: "VWCE",
  isin: "IE00BK5BQT80",
  exchange: "Xetra",
  currency: "EUR",
  assetType: "ETF",
  yahooSymbol: "VWCE.DE",
  eodhdSymbol: "VWCE.XETRA",
};

describe("parseEodhdHistory", () => {
  it("uses the last valid daily close and the prior close", () => {
    const record = parseEodhdHistory(instrument, [
      { date: "2026-07-10", close: 133.2 },
      { date: "2026-07-13", close: 134.1 },
    ], "2026-07-13T18:00:00.000Z");
    expect(record.quote.price).toBe(134.1);
    expect(record.quote.previousClose).toBe(133.2);
    expect(record.quote.label).toContain("end-of-day");
  });

  it("rejects provider errors and incomplete rows", () => {
    expect(() => parseEodhdHistory(instrument, { code: 429 })).toThrow("invalid");
    expect(() => parseEodhdHistory(instrument, [{ date: "bad", close: 0 }])).toThrow("no valid");
  });
});
