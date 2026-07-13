import { describe, expect, it } from "vitest";
import { isAllowedEodhdSymbol, isValidFromDate } from "./validation";

describe("Worker EODHD validation", () => {
  it("allows exact configured venues and rejects suffix substitutions", () => {
    expect(isAllowedEodhdSymbol("ANAU.MI", [])).toBe(true);
    expect(isAllowedEodhdSymbol("JEDI.XETRA", [])).toBe(true);
    expect(isAllowedEodhdSymbol("JEDI.US", [])).toBe(false);
  });

  it("accepts only real, bounded ISO dates", () => {
    const today = new Date("2026-07-13T12:00:00Z");
    expect(isValidFromDate("2025-07-13", today)).toBe(true);
    expect(isValidFromDate("2026-02-31", today)).toBe(false);
    expect(isValidFromDate("2027-01-01", today)).toBe(false);
  });
});
