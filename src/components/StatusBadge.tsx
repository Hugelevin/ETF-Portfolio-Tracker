import type { MarketQuote } from "../types";

function status(label: string, tone: string) {
  return <span className={`status ${tone}`} aria-label={`Market status: ${label}`} title={label}>
    <span className="status-dot" aria-hidden="true">✓</span>
    <span className="status-label">{label}</span>
  </span>;
}

export function StatusBadge({ quote, loading, error }: { quote: MarketQuote | null; loading?: boolean; error?: string }) {
  if (loading) return status("Loading Market Data…", "loading");
  if (!quote) return status(`Market Data Unavailable${error ? ` - ${error}` : ""}`, "unavailable");
  const badge = quote.stale || quote.source === "cache"
    ? status("Previous Update", "stale")
    : status(quote.label, "available");
  return <span className="status-stack">{badge}{error && <span className="fallback-reason">Fallback reason: {error}</span>}</span>;
}
