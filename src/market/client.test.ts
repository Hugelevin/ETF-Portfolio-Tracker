import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYahooRecord } from "./client";
import { SAMPLE_PORTFOLIO } from "../config/samplePortfolio";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("market request lifecycle", () => {
  it("replaces aggregated MAX candles with daily history", async () => {
    const instrument = SAMPLE_PORTFOLIO.instruments[0]!;
    const payload = (interval: string, closes: number[]) => ({ chart: { result: [{ meta: { symbol: instrument.yahooSymbol, currency: "EUR", fullExchangeName: "XETRA", instrumentType: "ETF", dataGranularity: interval }, timestamp: closes.map((_, index) => Date.parse(`2026-08-${String(index + 3).padStart(2, "0")}T15:00:00Z`) / 1000), indicators: { quote: [{ close: closes }] } }] } });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(payload("1mo", [50, 60])))).mockResolvedValueOnce(new Response(JSON.stringify(payload("1d", [50, 51, 52]))));
    vi.stubGlobal("fetch", fetcher);
    const record = await fetchYahooRecord(instrument, "MAX", "https://market.test");
    expect(record.historyInterval).toBe("1d");
    expect(record.history.map((point) => point.close)).toEqual([50, 51, 52]);
    expect(String(fetcher.mock.calls[1]![0])).toContain("range=1y&interval=1d");
  });

  it("recovers missing ETF daily history from the last observed hourly price of each day", async () => {
    const instrument = SAMPLE_PORTFOLIO.instruments[0]!;
    const payload = (interval: string, times: string[], closes: number[]) => ({ chart: { result: [{ meta: { symbol: instrument.yahooSymbol, currency: "EUR", fullExchangeName: "XETRA", instrumentType: "ETF", dataGranularity: interval }, timestamp: times.map((time) => Date.parse(time) / 1000), indicators: { quote: [{ close: closes }] } }] } });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(payload("1d", ["2026-08-04T15:00:00Z"], [52])))).mockResolvedValueOnce(new Response(JSON.stringify(payload("1h", ["2026-08-03T08:00:00Z", "2026-08-03T15:00:00Z", "2026-08-04T15:00:00Z"], [50, 51, 52]))));
    vi.stubGlobal("fetch", fetcher);
    const record = await fetchYahooRecord(instrument, "1Y", "https://market.test");
    expect(record.history.map((point) => point.close)).toEqual([51, 52]);
    expect(record.historyDerivedFromIntraday).toBe(true);
    expect(String(fetcher.mock.calls[1]![0])).toContain("range=1y&interval=1h");
  });
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
