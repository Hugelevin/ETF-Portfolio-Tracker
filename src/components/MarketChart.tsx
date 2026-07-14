import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildPositionValueHistory, calculateChartDomain, downsamplePoints } from "../domain/portfolio";
import { formatMoney, formatPercent } from "../format";
import type { MarketPoint, PurchaseLot } from "../types";
import { calculatePriceDomain } from "./chartDomain";

export type ChartMode = "price" | "value";

interface Props {
  history: MarketPoint[];
  lots: PurchaseLot[];
  mode: ChartMode;
  currency: string;
  averagePurchasePrice: number;
}

interface ChartDatum {
  timestamp: string;
  label: string;
  price: number;
  marketValue?: number;
  investedValue?: number;
  change: number;
  changePercentage: number | null;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  currency: string;
  mode: ChartMode;
}

function chartLabel(timestamp: string, intraday: boolean) {
  return new Date(timestamp).toLocaleString("en-GB", intraday
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" });
}

function ownedPosition(lots: PurchaseLot[], timestamp: string) {
  const date = timestamp.slice(0, 10);
  const owned = lots.filter((lot) => lot.purchaseDate <= date);
  return {
    shares: owned.reduce((sum, lot) => sum + lot.shares, 0),
    invested: owned.reduce((sum, lot) => sum + lot.shares * lot.pricePerShare, 0),
  };
}

function ChartTooltip({ active, payload, currency, mode }: ChartTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="chart-tooltip">
    <strong>{point.label}</strong>
    <dl>
      <div><dt>Price</dt><dd>{formatMoney(point.price, currency)}</dd></div>
      {mode === "value" && <>
        <div><dt>Holding Value</dt><dd>{point.marketValue === undefined ? "Not Held" : formatMoney(point.marketValue, currency)}</dd></div>
        <div><dt>Change</dt><dd className={point.change < 0 ? "negative-text" : point.change > 0 ? "positive-text" : ""}>{formatMoney(point.change, currency)} {formatPercent(point.changePercentage)}</dd></div>
      </>}
    </dl>
  </div>;
}

export function MarketChart({ history, lots, mode, currency, averagePurchasePrice }: Props) {
  const [tableOpen, setTableOpen] = useState(false);
  const [visibleRows, setVisibleRows] = useState(50);
  const intraday = useMemo(() => history.some((point, index) => (
    index > 0 && point.timestamp.slice(0, 10) === history[index - 1]?.timestamp.slice(0, 10)
  )), [history]);
  const priceData = useMemo(() => {
    const firstPrice = history[0]?.close ?? null;
    return history.map((point): ChartDatum => {
      const owned = ownedPosition(lots, point.timestamp);
      const change = firstPrice === null ? 0 : point.close - firstPrice;
      return {
        timestamp: point.timestamp,
        label: chartLabel(point.timestamp, intraday),
        price: point.close,
        marketValue: owned.shares > 0 ? owned.shares * point.close : undefined,
        investedValue: owned.shares > 0 ? owned.invested : undefined,
        change,
        changePercentage: firstPrice && firstPrice > 0 ? (change / firstPrice) * 100 : null,
      };
    });
  }, [history, intraday, lots]);
  const valueData = useMemo(() => {
    const priceByTimestamp = new Map(history.map((point) => [point.timestamp, point.close]));
    return buildPositionValueHistory(lots, history).map((point): ChartDatum => {
      const price = priceByTimestamp.get(point.timestamp) ?? 0;
      const change = point.marketValue - point.investedValue;
      return {
        ...point,
        label: chartLabel(point.timestamp, intraday),
        price,
        change,
        changePercentage: point.investedValue > 0 ? (change / point.investedValue) * 100 : null,
      };
    });
  }, [history, lots, intraday]);
  const data = mode === "price" ? priceData : valueData;
  const chartData = useMemo(() => downsamplePoints(data, 90), [data]);
  useEffect(() => {
    setTableOpen(false);
    setVisibleRows(50);
  }, [history, mode]);
  const domain = useMemo(() => mode === "price"
    ? calculatePriceDomain(priceData)
    : calculateChartDomain(valueData.map((point) => ({ timestamp: point.timestamp, marketValue: point.marketValue ?? 0, investedValue: point.investedValue ?? 0 })), true), [mode, priceData, valueData]);
  const averageBuyVisible = mode === "price" && averagePurchasePrice > 0
    && averagePurchasePrice >= domain[0] && averagePurchasePrice <= domain[1];

  if (!data.length) {
    const message = mode === "value"
      ? "No holding value exists in this range because it is before your first purchase."
      : "Historical market prices are unavailable for this range.";
    return <div className="chart-empty">{message}</div>;
  }

  const ariaLabel = mode === "price"
    ? `Historical market price chart with ${data.length} data points${averageBuyVisible ? " and average buy price baseline" : ""}`
    : `Historical holding value and invested cost chart with ${data.length} data points`;

  return <>
    <div className="chart-key" aria-hidden="true">
      {mode === "price" ? <><span><i className="key-market" /> Market Price</span>{averageBuyVisible && <span><i className="key-invested dashed" /> Average Buy {formatMoney(averagePurchasePrice, currency)}</span>}</> : <><span><i className="key-market" /> Holding Value</span><span><i className="key-invested" /> Invested Cost</span></>}
    </div>
    <div className="chart" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 16, right: 12, left: 4, bottom: 0 }}>
          <defs><linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#296f63" stopOpacity={0.28}/><stop offset="100%" stopColor="#296f63" stopOpacity={0.02}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dfe7e4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={36} />
          <YAxis domain={domain} tickFormatter={(value: number) => mode === "price"
            ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value)
            : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(value)} tickLine={false} axisLine={false} width={58} />
          <Tooltip content={<ChartTooltip currency={currency} mode={mode} />} cursor={{ stroke: "#94aaa4", strokeDasharray: "3 3" }} />
          {mode === "price" ? <>
            <Area type="monotone" dataKey="price" name="Market Price" stroke="#296f63" strokeWidth={2.5} fill="url(#marketFill)" dot={chartData.length <= 2 ? { r: 3 } : false} />
            {averageBuyVisible && <ReferenceLine y={averagePurchasePrice} stroke="#d18b3f" strokeWidth={2} strokeDasharray="6 5" />}
          </> : <>
            <Area type="monotone" dataKey="marketValue" name="Holding Value" stroke="#296f63" strokeWidth={2.5} fill="url(#marketFill)" dot={chartData.length <= 2 ? { r: 3 } : false} />
            <Line type="stepAfter" dataKey="investedValue" name="Invested Cost" stroke="#d18b3f" strokeWidth={2} dot={chartData.length <= 2 ? { r: 3 } : false} />
          </>}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <details className="data-alternative" open={tableOpen} onToggle={(event) => setTableOpen(event.currentTarget.open)}>
      <summary><Table2 aria-hidden="true" /><span>View Chart Data as a Table</span><ChevronDown className="data-chevron" aria-hidden="true" /></summary>
      {tableOpen && <><div className="compact-table">
        {mode === "price" ? <table aria-label="Historical market prices"><thead><tr><th>Date</th><th>Price</th></tr></thead><tbody>{priceData.slice(0, visibleRows).map((point) => <tr key={point.timestamp}><td>{point.label}</td><td>{formatMoney(point.price, currency)}</td></tr>)}</tbody></table> : <table aria-label="Historical holding values"><thead><tr><th>Date</th><th>Price</th><th>Holding Value</th><th>Invested Cost</th><th>Change</th></tr></thead><tbody>{valueData.slice(0, visibleRows).map((point) => <tr key={point.timestamp}><td>{point.label}</td><td>{formatMoney(point.price, currency)}</td><td>{formatMoney(point.marketValue ?? null, currency)}</td><td>{formatMoney(point.investedValue ?? null, currency)}</td><td>{formatMoney(point.change, currency)} {formatPercent(point.changePercentage)}</td></tr>)}</tbody></table>}
      </div>{visibleRows < data.length && <button type="button" className="button secondary show-more-data" onClick={() => setVisibleRows((current) => current + 50)}>Show 50 More Rows</button>}</>}
    </details>
  </>;
}
