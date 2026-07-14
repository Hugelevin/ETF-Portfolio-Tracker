import { describe, expect, it } from "vitest";
import { calculatePriceDomain } from "./chartDomain";

describe("calculatePriceDomain", () => {
  it("keeps intraday movement readable when the average purchase price is far away", () => {
    const domain = calculatePriceDomain([
      { price: 100 },
      { price: 100.5 },
      { price: 101 },
    ]);

    expect(domain[0]).toBeGreaterThan(99);
    expect(domain[1]).toBeLessThan(102);
  });
});
