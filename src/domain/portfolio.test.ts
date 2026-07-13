import { describe, expect, it } from "vitest";
import {
  buildPositionValueHistory,
  calculatePeriodPerformance,
  calculatePortfolioSummary,
  calculatePosition,
} from "./portfolio";
import type { Instrument, MarketQuote, PurchaseLot } from "../types";

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

const quote: MarketQuote = {
  instrumentId: instrument.id,
  price: 80,
  previousClose: 79,
  currency: "EUR",
  exchange: "Xetra",
  asOf: "2026-07-13T10:00:00.000Z",
  fetchedAt: "2026-07-13T10:00:10.000Z",
  source: "yahoo",
  label: "Latest available — best effort",
  stale: false,
};

describe("calculatePosition", () => {
  it("combines multiple lots while retaining fees in total cost", () => {
    const lots: PurchaseLot[] = [
      { id: "lot-1", instrumentId: instrument.id, shares: 10, pricePerShare: 70, purchaseDate: "2026-01-02", fees: 2 },
      { id: "lot-2", instrumentId: instrument.id, shares: 15, pricePerShare: 76.8, purchaseDate: "2026-02-02", fees: 3 },
    ];

    const position = calculatePosition(instrument, lots, quote);

    expect(position.totalShares).toBe(25);
    expect(position.totalCost).toBe(1_857);
    expect(position.averagePurchasePrice).toBeCloseTo(74.08);
    expect(position.currentValue).toBe(2_000);
    expect(position.profitLoss).toBe(143);
    expect(position.profitLossPercentage).toBeCloseTo(7.7006);
    expect(position.dailyChange).toBe(25);
    expect(position.dailyChangePercentage).toBeCloseTo(1.2658);
  });

  it("keeps valuation fields unavailable when no market price exists", () => {
    const lots: PurchaseLot[] = [
      { id: "lot-1", instrumentId: instrument.id, shares: 25, pricePerShare: 76.8, purchaseDate: "2026-01-02", fees: 0 },
    ];

    const position = calculatePosition(instrument, lots, null);

    expect(position.totalCost).toBe(1_920);
    expect(position.currentValue).toBeNull();
    expect(position.profitLoss).toBeNull();
    expect(position.profitLossPercentage).toBeNull();
    expect(position.dailyChange).toBeNull();
    expect(position.dailyChangePercentage).toBeNull();
  });
});

describe("calculatePortfolioSummary", () => {
  it("totals only EUR positions and reports missing-price coverage", () => {
    const eurPriced = calculatePosition(instrument, [
      { id: "lot-1", instrumentId: instrument.id, shares: 25, pricePerShare: 76.8, purchaseDate: "2026-01-02", fees: 0 },
    ], quote);
    const unpricedInstrument = { ...instrument, id: "unpriced", ticker: "WAIT", yahooSymbol: "WAIT.DE" };
    const eurUnpriced = calculatePosition(unpricedInstrument, [
      { id: "lot-2", instrumentId: "unpriced", shares: 2, pricePerShare: 50, purchaseDate: "2026-01-02", fees: 1 },
    ], null);
    const usdInstrument = { ...instrument, id: "usd", ticker: "USD", currency: "USD", yahooSymbol: "USD" };
    const usdPosition = calculatePosition(usdInstrument, [
      { id: "lot-3", instrumentId: "usd", shares: 2, pricePerShare: 40, purchaseDate: "2026-01-02", fees: 0 },
    ], { ...quote, instrumentId: "usd", currency: "USD", price: 45 });

    const summary = calculatePortfolioSummary([eurPriced, eurUnpriced, usdPosition], "EUR");

    expect(summary.totalInvested).toBe(2_021);
    expect(summary.currentValue).toBe(2_000);
    expect(summary.profitLoss).toBe(80);
    expect(summary.pricedPositions).toBe(1);
    expect(summary.totalPositions).toBe(3);
    expect(summary.dailyChange).toBe(25);
    expect(summary.dailyChangePositions).toBe(1);
    expect(summary.excludedPositionIds).toEqual(["unpriced", "usd"]);
  });

  it("does not present a missing previous close as a zero daily move", () => {
    const position = calculatePosition(instrument, [
      { id: "lot-1", instrumentId: instrument.id, shares: 1, pricePerShare: 70, purchaseDate: "2026-01-02", fees: 0 },
    ], { ...quote, previousClose: null });

    const summary = calculatePortfolioSummary([position], "EUR");

    expect(summary.dailyChange).toBeNull();
    expect(summary.dailyChangePositions).toBe(0);
  });
});

describe("buildPositionValueHistory", () => {
  it("compares historical market value with cumulative invested cost", () => {
    const lots: PurchaseLot[] = [
      { id: "lot-1", instrumentId: instrument.id, shares: 10, pricePerShare: 70, purchaseDate: "2026-01-02", fees: 2 },
      { id: "lot-2", instrumentId: instrument.id, shares: 5, pricePerShare: 80, purchaseDate: "2026-01-04", fees: 1 },
    ];
    const history = buildPositionValueHistory(lots, [
      { timestamp: "2026-01-03T16:30:00.000Z", close: 75 },
      { timestamp: "2026-01-05T16:30:00.000Z", close: 82 },
    ]);

    expect(history).toEqual([
      { timestamp: "2026-01-03T16:30:00.000Z", investedValue: 702, marketValue: 750 },
      { timestamp: "2026-01-05T16:30:00.000Z", investedValue: 1_103, marketValue: 1_230 },
    ]);
  });
});

describe("calculatePeriodPerformance", () => {
  it("uses the last close on or before the weekly target date", () => {
    const performance = calculatePeriodPerformance([
      { timestamp: "2026-07-03T16:30:00.000Z", close: 70 },
      { timestamp: "2026-07-06T16:30:00.000Z", close: 72 },
      { timestamp: "2026-07-13T16:30:00.000Z", close: 79.2 },
    ], "1W");

    expect(performance?.value).toBeCloseTo(7.2);
    expect(performance?.percentage).toBeCloseTo(10);
    expect(performance?.referenceTimestamp).toBe("2026-07-06T16:30:00.000Z");
  });
});
