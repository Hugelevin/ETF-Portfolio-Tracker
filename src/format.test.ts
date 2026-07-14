import { describe, expect, it } from "vitest";
import { formatDate, toLocalIsoDate } from "./format";

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
