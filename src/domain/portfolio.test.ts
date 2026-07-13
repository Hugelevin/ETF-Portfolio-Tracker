import { describe, expect, it } from "vitest";
import {
  buildPositionValueHistory,
  calculateAnnualisedYield,
  calculateChartDomain,
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
  label: "Market data",
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
    expect(position.purchaseCostExcludingFees).toBe(1_852);
    expect(position.totalFees).toBe(5);
    expect(position.totalCost).toBe(1_857);
    expect(position.averagePurchasePrice).toBeCloseTo(74.08);
    expect(position.currentValue).toBe(2_000);
    expect(position.marketReturn).toBe(148);
    expect(position.marketReturnPercentage).toBeCloseTo(7.9914);
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

  it("does not invent a money-market balance from a stored yield percentage", () => {
    const fund: Instrument = {
      id: "ummepsa-nav-eur",
      name: "UBS (Irl) Select Money Market Fund - EUR P Acc",
      ticker: "UMMEPSA",
      isin: "IE00BWWCR731",
      exchange: "Moneybase cash fund",
      currency: "EUR",
      assetType: "FUND",
      yahooSymbol: "",
      annualYieldPercentage: 2.28,
    };
    const lots: PurchaseLot[] = [
      { id: "cash-1", instrumentId: fund.id, shares: 10, pricePerShare: 100, purchaseDate: "2025-06-13", fees: 0 },
    ];

    const position = calculatePosition(fund, lots, null);

    expect(position.totalCost).toBe(1_000);
    expect(position.currentValue).toBeNull();
    expect(position.profitLoss).toBeNull();
    expect(position.dailyChange).toBeNull();
    expect(position.dailyChangePercentage).toBeNull();
  });

  it("uses the published fund NAV before the APY estimate", () => {
    const fund: Instrument = {
      id: "ummepsa-nav-eur",
      name: "UBS (Irl) Select Money Market Fund - EUR P Acc",
      ticker: "UMMEPSA",
      isin: "IE00BWWCR731",
      exchange: "Moneybase Cash Fund",
      currency: "EUR",
      assetType: "FUND",
      yahooSymbol: "0P0001CD0Q.F",
      annualYieldPercentage: 2.28,
    };
    const lots: PurchaseLot[] = [
      { id: "cash-1", instrumentId: fund.id, shares: 10, pricePerShare: 100, purchaseDate: "2026-05-20", fees: 0 },
    ];
    const navQuote: MarketQuote = {
      ...quote,
      instrumentId: fund.id,
      price: 100.2,
      previousClose: 100.19,
      exchange: "Daily Fund NAV",
    };

    const position = calculatePosition(fund, lots, navQuote);

    expect(position.currentValue).toBeCloseTo(1_002, 6);
    expect(position.marketReturn).toBeCloseTo(2, 6);
    expect(position.quote).toBe(navQuote);
  });

  it("does not calculate a fund return when a legacy cost basis is incompatible with NAV", () => {
    const fund: Instrument = {
      ...instrument,
      id: "cash-fund",
      assetType: "FUND",
      annualYieldPercentage: 2.28,
    };
    const lots: PurchaseLot[] = [
      { id: "legacy-cash", instrumentId: fund.id, shares: 10, pricePerShare: 10, purchaseDate: "2026-05-20", fees: 0 },
    ];
    const navQuote: MarketQuote = {
      ...quote,
      instrumentId: fund.id,
      price: 100,
      previousClose: 99.99,
    };

    const position = calculatePosition(fund, lots, navQuote);

    expect(position.currentValue).toBeNull();
    expect(position.marketReturn).toBeNull();
    expect(position.costBasisWarning).toMatch(/not comparable with the current NAV/i);
  });

  it("keeps legacy yield history from affecting valuation without NAV", () => {
    const fund: Instrument = {
      ...instrument,
      id: "cash",
      assetType: "FUND",
      annualYieldPercentage: 3,
      annualYieldHistory: [
        { effectiveDate: "2026-01-01", annualYieldPercentage: 2 },
        { effectiveDate: "2026-07-01", annualYieldPercentage: 3 },
      ],
    };
    const lots: PurchaseLot[] = [
      { id: "cash-1", instrumentId: fund.id, shares: 100, pricePerShare: 10, purchaseDate: "2026-01-01", fees: 0 },
    ];

    const position = calculatePosition(fund, lots, null);
    expect(position.currentValue).toBeNull();
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

    expect(summary.totalInvested).toBe(2_020);
    expect(summary.totalFees).toBe(1);
    expect(summary.currentValue).toBe(2_000);
    expect(summary.marketReturn).toBe(80);
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
      { timestamp: "2026-01-03T16:30:00.000Z", investedValue: 700, marketValue: 750 },
      { timestamp: "2026-01-05T16:30:00.000Z", investedValue: 1_100, marketValue: 1_230 },
    ]);
  });

  it("omits dates before the first purchase instead of plotting a false zero", () => {
    const lots: PurchaseLot[] = [
      { id: "lot-1", instrumentId: instrument.id, shares: 10, pricePerShare: 70, purchaseDate: "2026-01-04", fees: 2 },
    ];

    const history = buildPositionValueHistory(lots, [
      { timestamp: "2026-01-03T16:30:00.000Z", close: 75 },
      { timestamp: "2026-01-05T16:30:00.000Z", close: 82 },
    ]);

    expect(history).toEqual([
      { timestamp: "2026-01-05T16:30:00.000Z", investedValue: 700, marketValue: 820 },
    ]);
  });

  it("scales the chart around portfolio values instead of forcing zero into view", () => {
    const domain = calculateChartDomain([
      { timestamp: "2026-06-19T16:30:00.000Z", investedValue: 1_000, marketValue: 1_100 },
      { timestamp: "2026-06-20T16:30:00.000Z", investedValue: 1_000, marketValue: 1_120 },
    ], true);

    expect(domain[0]).toBeGreaterThan(900);
    expect(domain[0]).toBeLessThanOrEqual(1_000);
    expect(domain[1]).toBeGreaterThanOrEqual(1_120);
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

describe("calculateAnnualisedYield", () => {
  it("derives a trailing annualised yield from published NAV history", () => {
    const history = [
      { timestamp: "2026-07-06T08:00:00.000Z", close: 100 },
      { timestamp: "2026-07-13T08:00:00.000Z", close: 100.1 },
    ];

    const result = calculateAnnualisedYield(history, 7);

    expect(result?.percentage).toBeCloseTo(((100.1 / 100) ** (365 / 7) - 1) * 100, 8);
    expect(result?.days).toBe(7);
  });

  it("returns unavailable when there is not enough NAV history", () => {
    expect(calculateAnnualisedYield([
      { timestamp: "2026-07-13T08:00:00.000Z", close: 100.1 },
    ], 7)).toBeNull();
  });

  it("does not label sparse old NAV history as a current trailing yield", () => {
    expect(calculateAnnualisedYield([
      { timestamp: "2026-06-01T08:00:00.000Z", close: 100 },
      { timestamp: "2026-07-13T08:00:00.000Z", close: 100.2 },
    ], 7)).toBeNull();
  });
});
