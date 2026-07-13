import type { PortfolioDocument } from "../types";

// Public illustrative data only. The real portfolio is imported locally and is never committed.
export const SAMPLE_PORTFOLIO: PortfolioDocument = {
  schemaVersion: 1,
  baseCurrency: "EUR",
  instruments: [{
    id: "jedi-xetra-eur",
    name: "VanEck Space Innovators UCITS ETF",
    ticker: "JEDI",
    isin: "IE000YU9K6K2",
    exchange: "Xetra",
    micCode: "XETR",
    currency: "EUR",
    assetType: "ETF",
    yahooSymbol: "JEDI.DE",
    eodhdSymbol: "JEDI.XETRA",
  }],
  lots: [{
    id: "sample-jedi-lot",
    instrumentId: "jedi-xetra-eur",
    shares: 25,
    pricePerShare: 76.8,
    purchaseDate: "2026-01-02",
    fees: 0,
  }],
};
