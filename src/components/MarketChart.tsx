import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildPositionValueHistory, calculateChartDomain } from "../domain/portfolio";
import { formatMoney } from "../format";
import type { MarketPoint, PurchaseLot } from "../types";

export function MarketChart({ history, lots, compare, currency }: { history: MarketPoint[]; lots: PurchaseLot[]; compare: boolean; currency: string }) {
  const data = useMemo(() => buildPositionValueHistory(lots, history).map((point) => ({ ...point, label: new Date(point.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: history.length < 100 ? undefined : "2-digit" }) })), [history, lots]);
  const domain = useMemo(() => calculateChartDomain(data, compare), [data, compare]);
  if (!data.length) return <div className="chart-empty">Historical data is unavailable for this range.</div>;
  return <>
    <div className="chart" role="img" aria-label={`Historical market value chart with ${data.length} data points`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs><linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#296f63" stopOpacity={0.35}/><stop offset="100%" stopColor="#296f63" stopOpacity={0.02}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dfe7e4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} />
          <YAxis domain={domain} tickFormatter={(value: number) => new Intl.NumberFormat("en-GB", { notation: "compact" }).format(value)} tickLine={false} axisLine={false} width={52} />
          <Tooltip formatter={(value) => formatMoney(typeof value === "number" ? value : Number(value), currency)} labelStyle={{ color: "#162824" }} />
          <Area type="monotone" dataKey="marketValue" name="Market Value" stroke="#296f63" strokeWidth={2.5} fill="url(#marketFill)" />
          {compare && <Line type="stepAfter" dataKey="investedValue" name="Invested Cost" stroke="#d18b3f" strokeWidth={2} dot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <details className="data-alternative"><summary>View Chart Data as a Table</summary><div className="compact-table"><table><thead><tr><th>Date</th><th>Market Value</th><th>Invested Cost</th></tr></thead><tbody>{data.map((point) => <tr key={point.timestamp}><td>{point.label}</td><td>{formatMoney(point.marketValue, currency)}</td><td>{formatMoney(point.investedValue, currency)}</td></tr>)}</tbody></table></div></details>
  </>;
}
