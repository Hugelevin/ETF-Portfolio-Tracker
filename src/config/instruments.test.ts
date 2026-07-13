import { describe, expect, it } from "vitest";
import { VERIFIED_INSTRUMENTS } from "./instruments";

describe("verified instrument catalogue", () => {
  it("keeps exact unique ISIN, venue, currency and Yahoo identities", () => {
    expect(VERIFIED_INSTRUMENTS).toHaveLength(8);
    expect(new Set(VERIFIED_INSTRUMENTS.map((item) => `${item.isin}|${item.exchange}|${item.currency}`)).size).toBe(8);
    expect(new Set(VERIFIED_INSTRUMENTS.map((item) => item.yahooSymbol)).size).toBe(8);
  });

  it("identifies QUTM as the VanEck fund", () => {
    expect(VERIFIED_INSTRUMENTS.find((item) => item.isin === "IE0007Y8Y157")?.name).toBe("VanEck Quantum Computing UCITS ETF");
  });
});
