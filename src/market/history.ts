import type { ChartRange, MarketPoint } from "../types";

export function mergeHistory(existing: MarketPoint[], incoming: MarketPoint[]): MarketPoint[] {
  const points = new Map(existing.map((point) => [point.timestamp, point]));
  incoming.forEach((point) => points.set(point.timestamp, point));
  return [...points.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function filterHistoryForRange(history: MarketPoint[], range: ChartRange): MarketPoint[] {
  if (range === "MAX" || !history.length) return history;
  const latest = new Date(history.at(-1)!.timestamp);
  const cutoff = new Date(latest);
  if (range === "1D") cutoff.setUTCHours(cutoff.getUTCHours() - 24);
  if (range === "1W") cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  if (range === "1M") cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
  if (range === "3M") cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  if (range === "1Y") cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return history.filter((point) => Date.parse(point.timestamp) >= cutoff.getTime());
}
