import { useMemo } from "react";
import { filterHistoryForRange } from "../market/history";
import type { MarketPoint } from "../types";

interface Props {
  history: MarketPoint[];
  ticker: string;
}

export function HoldingSparkline({ history, ticker }: Props) {
  const points = useMemo(() => filterHistoryForRange(history, "1W")
    .filter((point) => Number.isFinite(point.close) && point.close > 0), [history]);

  if (points.length < 2) {
    return <span className="holding-sparkline empty" aria-label={`${ticker} 7-day price history unavailable`}>
      <span>7D</span><small>Unavailable</small>
    </span>;
  }

  const xOffset = 10;
  const width = 140;
  const height = 55;
  const inset = 3;
  const values = points.map((point) => point.close);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum;
  const coordinates = points.map((point, index) => {
    const x = xOffset + inset + (index / (points.length - 1)) * (width - inset * 2);
    const y = span === 0
      ? height / 2
      : inset + ((maximum - point.close) / span) * (height - inset * 2);
    return [x, y] as const;
  });
  const line = coordinates.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${(xOffset + width - inset).toFixed(1)},${(height - inset).toFixed(1)} L${(xOffset + inset).toFixed(1)},${(height - inset).toFixed(1)} Z`;
  const rising = values.at(-1)! >= values[0]!;
  const colour = rising ? "#19725c" : "#b34a4a";

  return <span className="holding-sparkline">
    <span>7D</span>
    <svg viewBox={`${xOffset} 0 ${width} ${height}`} role="img" aria-label={`${ticker} 7-day price trend, ${rising ? "up" : "down"}`} preserveAspectRatio="none">
      <path d={area} fill={colour} opacity="0.09" />
      <path d={line} fill="none" stroke={colour} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  </span>;
}
