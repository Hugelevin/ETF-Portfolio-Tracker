import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPortfolioStorage } from "../data/storage";
import { SAMPLE_PORTFOLIO } from "../config/samplePortfolio";
import type { MarketRecord } from "../types";
import { fetchYahooRecord } from "./client";
import { useMarketData } from "./useMarketData";
import { instrumentIdentity } from "./service";

vi.mock("./client", () => ({ fetchYahooRecord: vi.fn() }));
const instrument = SAMPLE_PORTFOLIO.instruments[0]!;
const instruments = [instrument];
function record(price = 80): MarketRecord {
  const timestamp = new Date().toISOString();
  return { identity: instrumentIdentity(instrument), quote: { instrumentId: instrument.id, currency: "EUR", exchange: "Xetra", price,
    previousClose: 79, asOf: timestamp, fetchedAt: timestamp, source: "yahoo", stale: false, label: "Market Price" },
    history: [{ timestamp, close: price }] };
}
function deferred() {
  let resolve!: (record: MarketRecord) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<MarketRecord>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe("market updates", () => {
  it("does not attach a late MAX history error to a successfully refreshed current quote", async () => {
    const weekly = deferred(); const maximum = deferred();
    vi.mocked(fetchYahooRecord).mockImplementation((_instrument, range) => range === "MAX" ? maximum.promise : weekly.promise);
    const storage = createPortfolioStorage(localStorage);
    const { result } = renderHook(() => useMarketData(instruments, "https://market.test", storage));
    await waitFor(() => expect(fetchYahooRecord).toHaveBeenCalledTimes(1));
    act(() => { void result.current.refreshOne(instrument, "MAX"); });
    await act(async () => { weekly.resolve(record()); });
    await act(async () => { maximum.reject(new Error("History unavailable")); });
    expect(result.current.records[instrument.id]?.quote.source).toBe("yahoo");
    expect(result.current.errors[instrument.id]).toBe("");
    expect(result.current.chartErrors[`${instrument.id}:MAX`]).toBe("History unavailable");
  });
  it("keeps a current-price failure when a different history range succeeds later", async () => {
    const weekly = deferred(); const maximum = deferred();
    vi.mocked(fetchYahooRecord).mockImplementation((_instrument, range) => range === "MAX" ? maximum.promise : weekly.promise);
    const storage = createPortfolioStorage(localStorage);
    const { result } = renderHook(() => useMarketData(instruments, "https://market.test", storage));
    await waitFor(() => expect(fetchYahooRecord).toHaveBeenCalledTimes(1));
    act(() => { void result.current.refreshOne(instrument, "MAX"); });
    await act(async () => { weekly.reject(new Error("Quote refresh failed")); });
    await act(async () => { maximum.resolve(record()); });
    expect(result.current.errors[instrument.id]).toBe("Quote refresh failed");
    expect(result.current.chartErrors[`${instrument.id}:MAX`]).toBe("");
  });
  it("deduplicates identical in-flight requests and keeps loading until all ranges finish", async () => {
    const weekly = deferred(); const maximum = deferred();
    vi.mocked(fetchYahooRecord).mockImplementation((_instrument, range) => range === "MAX" ? maximum.promise : weekly.promise);
    const storage = createPortfolioStorage(localStorage);
    const { result } = renderHook(() => useMarketData(instruments, "https://market.test", storage));
    await waitFor(() => expect(fetchYahooRecord).toHaveBeenCalledTimes(1));
    act(() => { void result.current.refreshOne(instrument, "1W"); void result.current.refreshOne(instrument, "MAX"); });
    await waitFor(() => expect(fetchYahooRecord).toHaveBeenCalledTimes(2));
    await act(async () => { weekly.resolve(record()); });
    expect(result.current.loading.has(instrument.id)).toBe(true);
    expect(result.current.quoteLoading.has(instrument.id)).toBe(false);
    expect(result.current.chartLoading.has(`${instrument.id}:MAX`)).toBe(true);
    await act(async () => { maximum.resolve(record()); });
    expect(result.current.loading.size).toBe(0);
  });

  it("ignores a late response after the portfolio is cleared", async () => {
    const pending = deferred();
    vi.mocked(fetchYahooRecord).mockReturnValue(pending.promise);
    const storage = createPortfolioStorage(localStorage);
    const { result, rerender } = renderHook(({ holdings }) => useMarketData(holdings, "https://market.test", storage), { initialProps: { holdings: instruments } });
    await waitFor(() => expect(fetchYahooRecord).toHaveBeenCalledTimes(1));
    act(() => { result.current.reset(); rerender({ holdings: [] }); });
    await act(async () => { pending.resolve(record()); });
    expect(result.current.records).toEqual({});
    expect(result.current.chartRecords).toEqual({});
    expect(result.current.loading.size).toBe(0);
  });

  it("refreshes after a Worker URL change and ignores the old provider response", async () => {
    const old = deferred();
    vi.mocked(fetchYahooRecord).mockImplementation((_instrument, _range, url) => url.includes("old") ? old.promise : Promise.resolve(record(90)));
    const storage = createPortfolioStorage(localStorage);
    const { result, rerender } = renderHook(({ url }) => useMarketData(instruments, url, storage), { initialProps: { url: "https://old.test" } });
    await waitFor(() => expect(fetchYahooRecord).toHaveBeenCalledTimes(1));
    rerender({ url: "https://new.test" });
    await waitFor(() => expect(result.current.records[instrument.id]?.quote.price).toBe(90));
    await act(async () => { old.resolve(record(1000)); });
    expect(result.current.records[instrument.id]?.quote.price).toBe(90);
  });

  it("labels the retained price as cached after its refresh fails", async () => {
    vi.mocked(fetchYahooRecord).mockResolvedValue(record(90));
    const storage = createPortfolioStorage(localStorage);
    const { result } = renderHook(() => useMarketData(instruments, "https://market.test", storage));
    await waitFor(() => expect(result.current.records[instrument.id]?.quote.source).toBe("yahoo"));
    vi.mocked(fetchYahooRecord).mockRejectedValue(new TypeError("Network unavailable"));
    await act(async () => { await result.current.refreshOne(instrument, "1W", true); });
    expect(result.current.records[instrument.id]?.quote.price).toBe(90);
    expect(result.current.records[instrument.id]?.quote.source).toBe("cache");
    expect(result.current.errors[instrument.id]).toContain("Network unavailable");
  });
});
