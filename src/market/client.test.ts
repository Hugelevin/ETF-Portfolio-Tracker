import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYahooRecord } from "./client";
import { SAMPLE_PORTFOLIO } from "../config/samplePortfolio";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("market request lifecycle", () => {
  it("times out a hanging fetch and offers a retry", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const request = fetchYahooRecord(SAMPLE_PORTFOLIO.instruments[0]!, "1W", "https://market.test");
    const assertion = expect(request).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  it("reports rate limits even when an upstream response is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Too Many Requests", { status: 429 })));
    await expect(fetchYahooRecord(SAMPLE_PORTFOLIO.instruments[0]!, "1W", "https://market.test")).rejects.toThrow(/Rate limit/);
  });
});
