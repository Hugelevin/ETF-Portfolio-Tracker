import type { MarketQuote } from "../types";

const DELAYED_AFTER_MINUTES = 10;

function status(label: string, tone: string, title = label) {
  return <span className={`status ${tone}`} aria-label={`Market status: ${label}`} title={title}>
    <span className="status-dot" aria-hidden="true" />
    <span className="status-label">{label}</span>
  </span>;
}

export function StatusBadge({ quote, loading, error }: { quote: MarketQuote | null; loading?: boolean; error?: string }) {
  if (loading) return status("Updating", "loading", "Fetching Yahoo market data");
  const badge = !quote
    ? status("Unavailable", "unavailable", "No valid market price is available")
    : quote.source === "cache"
      ? status("Cached", "stale", "Showing the last successful price saved in this browser")
      : quote.marketSession === "closed"
        ? status("Closed", "closed", "Yahoo's regular trading session is closed")
        : quote.stale || (quote.marketSession === "open" && (quote.delayMinutes ?? 0) > DELAYED_AFTER_MINUTES)
          ? status("Delayed", "stale", "Yahoo's latest timestamp is behind the current open session")
          : status("Updated", "available", "Yahoo returned a recent timestamped price");
  return <span className="status-stack">{badge}{error && <span className="fallback-reason">{error}</span>}</span>;
}
