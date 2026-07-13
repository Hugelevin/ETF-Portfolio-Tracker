import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildPositionValueHistory, calculateChartDomain } from "../domain/portfolio";
import { formatMoney } from "../format";
import type { MarketPoint, PurchaseLot } from "../types";

export type ChartMode = "price" | "value";

interface Props {
  history: MarketPoint[];
  lots: PurchaseLot[];
  mode: ChartMode;
  currency: string;
}

interface ChartDatum {
  timestamp: string;
  label: string;
  price?: number;
  marketValue?: number;
  investedValue?: number;
}

function chartLabel(timestamp: string, intraday: boolean) {
  return new Date(timestamp).toLocaleString("en-GB", intraday
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" });
}

function priceDomain(points: Array<{ price: number }>): [number, number] {
  if (!points.length) return [0, 1];
  const prices = points.map((point) => point.price);
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const span = maximum - minimum;
  const padding = span > 0 ? span * 0.12 : Math.max(maximum * 0.01, 0.01);
  return [Math.max(0, minimum - padding), maximum + padding];
}

export function MarketChart({ history, lots, mode, currency }: Props) {
  const intraday = useMemo(() => history.some((point, index) => (
    index > 0 && point.timestamp.slice(0, 10) === history[index - 1]?.timestamp.slice(0, 10)
  )), [history]);
  const priceData = useMemo(() => history.map((point) => ({
    timestamp: point.timestamp,
    label: chartLabel(point.timestamp, intraday),
    price: point.close,
  })), [history, intraday]);
  const valueData = useMemo(() => buildPositionValueHistory(lots, history).map((point) => ({
    ...point,
    label: chartLabel(point.timestamp, intraday),
  })), [history, lots, intraday]);
  const data: ChartDatum[] = mode === "price" ? priceData : valueData;
  const domain = useMemo(() => mode === "price"
    ? priceDomain(priceData)
    : calculateChartDomain(valueData, true), [mode, priceData, valueData]);

  if (!data.length) {
    const message = mode === "value"
      ? "No position value exists in this range because it is before your first purchase."
      : "Historical market prices are unavailable for this range.";
    return <div className="chart-empty">{message}</div>;
  }

  const ariaLabel = mode === "price"
    ? `Historical market price chart with ${data.length} data points`
    : `Historical position value and invested cost chart with ${data.length} data points`;

  return <>
    <div className="chart" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
          <defs><linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#296f63" stopOpacity={0.28}/><stop offset="100%" stopColor="#296f63" stopOpacity={0.02}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dfe7e4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={36} />
          <YAxis domain={domain} tickFormatter={(value: number) => mode === "price"
            ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value)
            : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(value)} tickLine={false} axisLine={false} width={58} />
          <Tooltip formatter={(value) => formatMoney(typeof value === "number" ? value : Number(value), currency)} labelStyle={{ color: "#162824" }} />
          {mode === "price" ? <Area type="monotone" dataKey="price" name="Market Price" stroke="#296f63" strokeWidth={2.5} fill="url(#marketFill)" dot={data.length <= 2 ? { r: 3 } : false} /> : <>
            <Area type="monotone" dataKey="marketValue" name="Market Value" stroke="#296f63" strokeWidth={2.5} fill="url(#marketFill)" dot={data.length <= 2 ? { r: 3 } : false} />
            <Line type="stepAfter" dataKey="investedValue" name="Invested Amount" stroke="#d18b3f" strokeWidth={2} dot={data.length <= 2 ? { r: 3 } : false} />
          </>}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <details className="data-alternative">
      <summary>View Chart Data as a Table</summary>
      <div className="compact-table">
        {mode === "price" ? <table aria-label="Historical market prices"><thead><tr><th>Date</th><th>Market Price</th></tr></thead><tbody>{priceData.map((point) => <tr key={point.timestamp}><td>{point.label}</td><td>{formatMoney(point.price, currency)}</td></tr>)}</tbody></table> : <table aria-label="Historical position values"><thead><tr><th>Date</th><th>Market Value</th><th>Invested Amount</th></tr></thead><tbody>{valueData.map((point) => <tr key={point.timestamp}><td>{point.label}</td><td>{formatMoney(point.marketValue, currency)}</td><td>{formatMoney(point.investedValue, currency)}</td></tr>)}</tbody></table>}
      </div>
    </details>
  </>;
}
