import type { MarketQuote } from "../types";

export function StatusBadge({ quote, loading, error }: { quote: MarketQuote | null; loading?: boolean; error?: string }) {
  if (loading) return <span className="status loading">Loading price…</span>;
  if (!quote) return <span className="status unavailable">Price unavailable{error ? ` — ${error}` : ""}</span>;
  const badge = quote.source === "manual"
    ? <span className="status manual">Manual {quote.label.toLowerCase().replace("manual ", "")}</span>
    : quote.stale || quote.source === "cache"
      ? <span className="status stale">Previous update</span>
      : <span className="status available">{quote.label}</span>;
  return <span className="status-stack">{badge}{error && <span className="fallback-reason">Fallback reason: {error}</span>}</span>;
}
