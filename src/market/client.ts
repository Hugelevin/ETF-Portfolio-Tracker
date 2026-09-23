import type { ChartRange, Instrument, MarketRecord } from "../types";
import { parseYahooChart } from "./yahoo";

const RANGE_QUERY: Record<ChartRange, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "5m" },
  "1M": { range: "1mo", interval: "1h" },
  "3M": { range: "3mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "MAX": { range: "max", interval: "1d" },
};

const FUND_RANGE_QUERY: Record<ChartRange, { range: string; interval: string }> = {
  "1D": { range: "5d", interval: "1d" },
  "1W": { range: "5d", interval: "1d" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "MAX": { range: "max", interval: "1d" },
};

function endpoint(proxyUrl: string, path: string): URL {
  const base = proxyUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("Configure the market-data Worker URL in Settings");
  return new URL(`${base}${path}`);
}

async function fetchJson(url: URL, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  init?.signal?.addEventListener("abort", onAbort, { once: true });
  if (init?.signal?.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.status === 429) throw new Error("Rate limit reached. Wait a moment, then try Refresh Prices again.");
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(response.ok ? "Market provider returned an invalid response" : `Market request failed (${response.status}). Try again later.`);
    }
    if (!response.ok) {
      const message = typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : `Market request failed (${response.status})`;
      throw new Error(message);
    }
    return body;
  } catch (error) {
    if (timedOut) throw new Error("Market request timed out. Try Refresh Prices again.");
    throw error;
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchYahooRecord(
  instrument: Instrument,
  range: ChartRange,
  proxyUrl: string,
  signal?: AbortSignal,
): Promise<MarketRecord> {
  if (!instrument.yahooSymbol) throw new Error("No Yahoo Finance symbol is configured for this instrument");
  const url = endpoint(proxyUrl, "/yahoo/chart");
  const query = instrument.assetType === "FUND" ? FUND_RANGE_QUERY[range] : RANGE_QUERY[range];
  url.searchParams.set("symbol", instrument.yahooSymbol);
  url.searchParams.set("range", query.range);
  url.searchParams.set("interval", query.interval);
  return parseYahooChart(instrument, await fetchJson(url, { signal }));
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  assetType: string;
}

export async function searchYahoo(query: string, proxyUrl: string): Promise<SearchResult[]> {
  const url = endpoint(proxyUrl, "/yahoo/search");
  url.searchParams.set("q", query);
  const payload = await fetchJson(url);
  if (typeof payload !== "object" || payload === null || !("quotes" in payload) || !Array.isArray(payload.quotes)) {
    throw new Error("Market search returned an invalid response");
  }
  return payload.quotes.flatMap((entry): SearchResult[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const value = entry as Record<string, unknown>;
    if (typeof value.symbol !== "string" || typeof value.shortname !== "string") return [];
    return [{
      symbol: value.symbol,
      name: value.longname ? String(value.longname) : value.shortname,
      exchange: String(value.exchDisp ?? value.exchange ?? "Unknown"),
      currency: String(value.currency ?? ""),
      assetType: String(value.quoteType ?? ""),
    }];
  });
}
