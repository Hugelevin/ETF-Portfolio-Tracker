import { describe, expect, it } from "vitest";
import { parsePortfolioDocument } from "./schema";

const validPortfolio = {
  schemaVersion: 1,
  baseCurrency: "EUR",
  instruments: [
    {
      id: "jedi-xetra-eur",
      name: "VanEck Space Innovators UCITS ETF",
      ticker: "JEDI",
      isin: "IE000YU9K6K2",
      exchange: "Xetra",
      micCode: "XETR",
      currency: "EUR",
      assetType: "ETF",
      yahooSymbol: "JEDI.DE",
    },
  ],
  lots: [
    {
      id: "lot-1",
      instrumentId: "jedi-xetra-eur",
      shares: 25,
      pricePerShare: 76.8,
      purchaseDate: "2026-01-02",
      fees: 0,
    },
  ],
};

describe("parsePortfolioDocument", () => {
  it("accepts a valid versioned EUR portfolio", () => {
    const result = parsePortfolioDocument(validPortfolio);

    expect(result.lots[0]?.shares).toBe(25);
    expect(result.instruments[0]?.isin).toBe("IE000YU9K6K2");
  });

  it.each([
    ["zero shares", { shares: 0 }],
    ["negative price", { pricePerShare: -1 }],
    ["negative fees", { fees: -0.01 }],
    ["invalid numeric input", { shares: Number.NaN }],
  ])("rejects %s", (_label, lotChange) => {
    const invalid = structuredClone(validPortfolio);
    Object.assign(invalid.lots[0]!, lotChange);

    expect(() => parsePortfolioDocument(invalid)).toThrow();
  });

  it("rejects lots that refer to an unknown instrument", () => {
    const invalid = structuredClone(validPortfolio);
    invalid.lots[0]!.instrumentId = "missing";

    expect(() => parsePortfolioDocument(invalid)).toThrow(/Unknown instrument id/);
  });

  it.each(["2026-02-29", "2026-02-31", "2026-13-01"])("rejects impossible calendar date %s", (date) => {
    const invalid = structuredClone(validPortfolio);
    invalid.lots[0]!.purchaseDate = date;
    expect(() => parsePortfolioDocument(invalid)).toThrow(/valid purchase date/);
  });

  it("rejects duplicate ISIN, venue and currency identities under different ids", () => {
    const invalid = structuredClone(validPortfolio);
    invalid.instruments.push({ ...invalid.instruments[0]!, id: "duplicate-id" });
    expect(() => parsePortfolioDocument(invalid)).toThrow(/Duplicate instrument identity/);
  });
});
