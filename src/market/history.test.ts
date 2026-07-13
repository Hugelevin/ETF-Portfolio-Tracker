import { describe, expect, it } from "vitest";
import { filterHistoryForRange, mergeHistory } from "./history";

const history = [
  { timestamp: "2025-07-13T10:00:00.000Z", close: 60 },
  { timestamp: "2026-06-01T10:00:00.000Z", close: 70 },
  { timestamp: "2026-07-06T10:00:00.000Z", close: 75 },
  { timestamp: "2026-07-13T10:00:00.000Z", close: 80 },
];

describe("market history ranges", () => {
  it("filters chart data without discarding the wider performance history", () => {
    expect(filterHistoryForRange(history, "1W")).toHaveLength(2);
    expect(filterHistoryForRange(history, "1M")).toHaveLength(2);
    expect(filterHistoryForRange(history, "MAX")).toEqual(history);
  });

  it("merges range responses by timestamp and prefers the newer response", () => {
    expect(mergeHistory(history.slice(0, 2), [
      { timestamp: "2026-06-01T10:00:00.000Z", close: 71 },
      { timestamp: "2026-07-13T10:00:00.000Z", close: 80 },
    ])).toEqual([
      history[0],
      { timestamp: "2026-06-01T10:00:00.000Z", close: 71 },
      { timestamp: "2026-07-13T10:00:00.000Z", close: 80 },
    ]);
  });
});
