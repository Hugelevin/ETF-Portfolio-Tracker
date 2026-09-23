import { describe, expect, it } from "vitest";
import { buildPortfolioValueHistory, calculatePeriodPerformance, calculatePortfolioRiskStatistics, calculatePosition } from "./portfolio";
import { filterHistoryForRange } from "../market/history";
import { SAMPLE_PORTFOLIO } from "../config/samplePortfolio";

describe("calendar performance boundaries", () => {
  it.each([["2026-03-31", "2026-02-28"], ["2024-03-31", "2024-02-29"], ["2026-01-31", "2025-12-31"]])("clamps %s to the previous month's last date", (latest, previous) => {
    const history = [{ timestamp: `${previous}T16:00:00Z`, close: 100 }, { timestamp: `${latest}T16:00:00Z`, close: 110 }];
    expect(calculatePeriodPerformance(history, "1M")?.percentage).toBeCloseTo(10);
    expect(filterHistoryForRange(history, "1M")).toHaveLength(2);
  });

  it("uses Friday's close when the calendar-month target is Sunday", () => {
    const result = calculatePeriodPerformance([
      { timestamp: "2026-06-19T16:00:00Z", close: 100 },
      { timestamp: "2026-06-22T16:00:00Z", close: 105 },
      { timestamp: "2026-07-21T16:00:00Z", close: 110 },
    ], "1M");
    expect(result?.percentage).toBeCloseTo(10);
  });

  it("rejects sparse history instead of inventing a weekly return", () => {
    expect(calculatePeriodPerformance([{ timestamp: "2025-01-01", close: 10 }, { timestamp: "2026-07-21", close: 20 }], "1W")).toBeNull();
  });
});

describe("portfolio history accuracy", () => {
  const instrument = SAMPLE_PORTFOLIO.instruments[0]!;
  const position = calculatePosition(instrument, [{ ...SAMPLE_PORTFOLIO.lots[0]!, purchaseDate: "2026-01-01" }], null);
  it("orders unsorted prices, carries weekends, and stops valuing stale gaps", () => {
    const second = { ...position, instrument: { ...instrument, id: "second" } };
    const history = buildPortfolioValueHistory([position, second], {
      [instrument.id]: [{ timestamp: "2026-01-05T16:00:00Z", close: 80 }, { timestamp: "2026-01-02T16:00:00Z", close: 70 }],
      second: [{ timestamp: "2026-01-02T16:00:00Z", close: 100 }, { timestamp: "2026-01-03T16:00:00Z", close: 101 }, { timestamp: "2026-02-01T16:00:00Z", close: 110 }],
    });
    expect(history.map((point) => point.timestamp.slice(0, 10))).toEqual(["2026-01-02", "2026-01-03", "2026-01-05"]);
    expect(history[0]!.marketValue).toBe(position.totalShares * 170);
    expect(history[2]!.marketValue).toBe(position.totalShares * 181);
  });

  it("does not rank an incomplete current month as best month", () => {
    const points = [
      { timestamp: "2026-01-30T16:00:00Z", marketValue: 100 },
      { timestamp: "2026-02-27T16:00:00Z", marketValue: 105 },
      { timestamp: "2026-03-10T16:00:00Z", marketValue: 200 },
    ].map((point) => ({ ...point, investedValue: 100, pricedPositions: 1 }));
    expect(calculatePortfolioRiskStatistics(points).bestMonth?.month).toBe("2026-02");
  });
});
