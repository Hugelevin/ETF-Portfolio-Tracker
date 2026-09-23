import { describe, expect, it } from "vitest";
import { downsamplePoints } from "./portfolio";

describe("extrema-preserving chart sampling", () => {
  it("keeps short spikes, endpoints and chronological order within the budget", () => {
    const points = Array.from({ length: 4_000 }, (_, index) => ({ index, price: 100 }));
    points[723]!.price = 180;
    points[725]!.price = 20;
    const sampled = downsamplePoints(points, 90, (point) => point.price);
    expect(sampled.length).toBeLessThanOrEqual(90);
    expect(sampled[0]).toBe(points[0]);
    expect(sampled.at(-1)).toBe(points.at(-1));
    expect(sampled).toContain(points[723]);
    expect(sampled).toContain(points[725]);
    expect(sampled.map((point) => point.index)).toEqual([...new Set(sampled.map((point) => point.index))].sort((a, b) => a - b));
  });

  it("leaves short series unchanged", () => {
    const points = [2, 1, 3];
    expect(downsamplePoints(points, 90, (point) => point)).toBe(points);
  });

  it("preserves both sides of every invested-cost step even without price extrema", () => {
    const points = Array.from({ length: 4_000 }, (_, index) => ({ index, value: 1_000, invested: index < 723 ? 500 : index < 2123 ? 600 : 700 }));
    const sampled = downsamplePoints(points, 90, (point) => point.value, (point) => point.invested);
    for (const index of [722, 723, 2122, 2123]) expect(sampled).toContain(points[index]);
    expect(sampled.length).toBeLessThanOrEqual(90);
  });
});
