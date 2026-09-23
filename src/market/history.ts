import type { ChartRange, MarketPoint } from "../types";
import { subtractUtcMonths } from "../domain/dates";

export function mergeHistory(existing: MarketPoint[], incoming: MarketPoint[]): MarketPoint[] {
  const points = new Map(existing.map((point) => [point.timestamp, point]));
  incoming.forEach((point) => points.set(point.timestamp, point));
  return [...points.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function filterHistoryForRange(history: MarketPoint[], range: ChartRange): MarketPoint[] {
  if (range === "MAX" || !history.length) return history;
  const latest = new Date(history.at(-1)!.timestamp);
  let cutoff = new Date(latest);
  if (range === "1D") cutoff.setUTCHours(cutoff.getUTCHours() - 24);
  if (range === "1W") cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  if (range === "1M") cutoff = subtractUtcMonths(latest, 1);
  if (range === "3M") cutoff = subtractUtcMonths(latest, 3);
  if (range === "1Y") cutoff = subtractUtcMonths(latest, 12);
  return history.filter((point) => Date.parse(point.timestamp) >= cutoff.getTime());
}
