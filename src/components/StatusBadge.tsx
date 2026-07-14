import type { MarketQuote } from "../types";

function status(label: string, tone: string) {
  return <span className={`status ${tone}`} aria-label={`Market status: ${label}`} title={label}>
    <span className="status-dot" aria-hidden="true" />
    <span className="status-label">{label}</span>
  </span>;
}

export function StatusBadge({ quote, loading, error }: { quote: MarketQuote | null; loading?: boolean; error?: string }) {
  if (loading) return status("Updating", "loading");
  const badge = !quote
    ? status("Unavailable", "unavailable")
    : quote.source === "cache"
      ? status("Cached", "stale")
      : quote.stale
        ? status("Delayed", "stale")
        : status("Updated", "available");
  return <span className="status-stack">{badge}{error && <span className="fallback-reason">{error}</span>}</span>;
}
