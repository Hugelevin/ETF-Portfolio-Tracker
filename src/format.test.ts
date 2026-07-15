import { describe, expect, it } from "vitest";
import { formatDate, formatPercentInBrackets, toLocalIsoDate } from "./format";

describe("toLocalIsoDate", () => {
  it("uses the browser-local calendar date", () => {
    const localDate = new Date(2026, 6, 14, 0, 30);

    expect(toLocalIsoDate(localDate)).toBe("2026-07-14");
  });
});

describe("formatDate", () => {
  it("formats order dates in British English without a timezone shift", () => {
    expect(formatDate("2026-01-02")).toBe("2 Jan 2026");
  });
});

describe("formatPercentInBrackets", () => {
  it("wraps signed percentages but leaves unavailable values readable", () => {
    expect(formatPercentInBrackets(1.234)).toBe("(+1.23%)");
    expect(formatPercentInBrackets(-1.234)).toBe("(-1.23%)");
    expect(formatPercentInBrackets(null)).toBe("Unavailable");
  });
});
