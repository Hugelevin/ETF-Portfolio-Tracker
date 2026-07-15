import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildTimeWeightedReturnSeries, calculateChartDomain, downsamplePoints, type PortfolioValuePoint } from "../domain/portfolio";
import { formatMoney, formatPercent } from "../format";

export type PortfolioHistoryMode = "value" | "return";

interface Datum extends PortfolioValuePoint { label: string; returnPercentage: number }

function TooltipContent({ active, payload, mode }: { active?: boolean; payload?: Array<{ payload: Datum }>; mode: PortfolioHistoryMode }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="chart-tooltip"><strong>{point.label}</strong><dl>{mode === "return" && <div><dt>Market Return</dt><dd>{formatPercent(point.returnPercentage)}</dd></div>}<div><dt>Portfolio Value</dt><dd>{formatMoney(point.marketValue)}</dd></div><div><dt>Invested</dt><dd>{formatMoney(point.investedValue)}</dd></div></dl></div>;
}

export function PortfolioHistoryChart({ points, mode = "value" }: { points: PortfolioValuePoint[]; mode?: PortfolioHistoryMode }) {
  const returnSeries = buildTimeWeightedReturnSeries(points);
  const enriched = points.map((point, index): Datum => ({
    ...point,
    label: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(point.timestamp)),
    returnPercentage: returnSeries[index]?.returnPercentage ?? 0,
  }));
  const data = downsamplePoints(enriched, 120);
  const returnValues = enriched.map((point) => point.returnPercentage);
  const returnMinimum = Math.min(0, ...returnValues);
  const returnMaximum = Math.max(0, ...returnValues);
  const returnSpan = returnMaximum - returnMinimum;
  const returnPadding = returnSpan > 0 ? returnSpan * 0.1 : 1;
  const domain = mode === "value" ? calculateChartDomain(points, true) : [returnMinimum - returnPadding, returnMaximum + returnPadding];
  const periodValues = mode === "value" ? points.map((point) => point.marketValue) : returnValues;
  const periodLow = periodValues.length ? Math.min(...periodValues) : null;
  const periodHigh = periodValues.length ? Math.max(...periodValues) : null;
  return <>
    <div className="chart-meta"><div className="chart-key" aria-hidden="true">{mode === "value" ? <><span><i className="key-market" /> Portfolio Value</span><span><i className="key-invested" /> Invested Capital</span></> : <span><i className="key-market" /> Market Return</span>}</div><dl className="chart-period-stats" aria-label={`Selected period portfolio ${mode === "value" ? "value" : "return"} range`}><div><dt>Low</dt><dd>{mode === "value" ? formatMoney(periodLow) : formatPercent(periodLow)}</dd></div><div><dt>High</dt><dd>{mode === "value" ? formatMoney(periodHigh) : formatPercent(periodHigh)}</dd></div></dl></div>
    <div className="chart portfolio-history-chart" role="img" aria-label={`Portfolio ${mode === "value" ? "value and invested capital" : "market return"} history with ${points.length} complete data points`}>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart accessibilityLayer={false} data={data} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dfe7e4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={34} />
        <YAxis domain={domain} tickFormatter={(value: number) => mode === "value" ? new Intl.NumberFormat("en-GB", { notation: "compact" }).format(value) : `${value.toFixed(1)}%`} tickLine={false} axisLine={false} width={54} />
        <Tooltip content={<TooltipContent mode={mode} />} cursor={{ stroke: "#94aaa4", strokeDasharray: "3 3" }} />
        {mode === "value" ? <><Area type="monotone" dataKey="marketValue" stroke="#296f63" strokeWidth={2.5} fill="#dcece7" dot={false} /><Line type="stepAfter" dataKey="investedValue" stroke="#d18b3f" strokeWidth={2} dot={false} /></> : <><ReferenceLine y={0} stroke="#9baba6" strokeDasharray="4 4" /><Area type="monotone" dataKey="returnPercentage" stroke="#296f63" strokeWidth={2.5} fill="#dcece7" dot={false} /></>}
      </ComposedChart></ResponsiveContainer>
    </div>
  </>;
}
