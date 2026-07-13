import { describe, expect, it } from "vitest";
import { toLocalIsoDate } from "./format";

describe("toLocalIsoDate", () => {
  it("uses the browser-local calendar date", () => {
    const localDate = new Date(2026, 6, 14, 0, 30);

    expect(toLocalIsoDate(localDate)).toBe("2026-07-14");
  });
});
