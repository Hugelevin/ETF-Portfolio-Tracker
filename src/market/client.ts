import type { ChartRange, Instrument, MarketRecord } from "../types";
import { parseEodhdHistory } from "./eodhd";
import { parseYahooChart } from "./yahoo";

const RANGE_QUERY: Record<ChartRange, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "5m" },
  "1M": { range: "1mo", interval: "1h" },
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
  const response = await fetch(url, init);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Market provider returned an invalid response");
  }
  if (!response.ok) {
    const message = typeof body === "object" && body && "error" in body
      ? String((body as { error: unknown }).error)
      : `Market request failed (${response.status})`;
    throw new Error(response.status === 429 ? `Rate limit reached: ${message}` : message);
  }
  return body;
}

export async function fetchYahooRecord(
  instrument: Instrument,
  range: ChartRange,
  proxyUrl: string,
): Promise<MarketRecord> {
  const url = endpoint(proxyUrl, "/yahoo/chart");
  const query = instrument.assetType === "FUND"
    ? { ...RANGE_QUERY[range], interval: "1d" }
    : RANGE_QUERY[range];
  url.searchParams.set("symbol", instrument.yahooSymbol);
  url.searchParams.set("range", query.range);
  url.searchParams.set("interval", query.interval);
  return parseYahooChart(instrument, await fetchJson(url));
}

export async function fetchEodhdRecord(
  instrument: Instrument,
  proxyUrl: string,
  apiKey: string,
): Promise<MarketRecord> {
  if (!instrument.eodhdSymbol) throw new Error("No EODHD identity is configured for this instrument");
  const url = endpoint(proxyUrl, "/eodhd/eod");
  url.searchParams.set("symbol", instrument.eodhdSymbol);
  const from = new Date();
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  url.searchParams.set("from", from.toISOString().slice(0, 10));
  const payload = await fetchJson(url, { headers: { "X-EODHD-Key": apiKey } });
  return parseEodhdHistory(instrument, payload);
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
