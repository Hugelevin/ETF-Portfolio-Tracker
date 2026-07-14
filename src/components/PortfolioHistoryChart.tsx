import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calculateChartDomain, downsamplePoints, type PortfolioValuePoint } from "../domain/portfolio";
import { formatMoney } from "../format";

interface Datum extends PortfolioValuePoint { label: string }

function TooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ payload: Datum }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="chart-tooltip"><strong>{point.label}</strong><dl><div><dt>Portfolio Value</dt><dd>{formatMoney(point.marketValue)}</dd></div><div><dt>Invested</dt><dd>{formatMoney(point.investedValue)}</dd></div></dl></div>;
}

export function PortfolioHistoryChart({ points }: { points: PortfolioValuePoint[] }) {
  const data: Datum[] = downsamplePoints(points, 120).map((point) => ({ ...point, label: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(point.timestamp)) }));
  const domain = calculateChartDomain(points, true);
  return <>
    <div className="chart-key" aria-hidden="true"><span><i className="key-market" /> Portfolio Value</span><span><i className="key-invested" /> Invested Capital</span></div>
    <div className="chart portfolio-history-chart" role="img" aria-label={`Portfolio value and invested capital history with ${points.length} complete data points`}>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dfe7e4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={34} />
        <YAxis domain={domain} tickFormatter={(value: number) => new Intl.NumberFormat("en-GB", { notation: "compact" }).format(value)} tickLine={false} axisLine={false} width={54} />
        <Tooltip content={<TooltipContent />} cursor={{ stroke: "#94aaa4", strokeDasharray: "3 3" }} />
        <Area type="monotone" dataKey="marketValue" stroke="#296f63" strokeWidth={2.5} fill="#dcece7" dot={false} />
        <Line type="stepAfter" dataKey="investedValue" stroke="#d18b3f" strokeWidth={2} dot={false} />
      </ComposedChart></ResponsiveContainer>
    </div>
  </>;
}
