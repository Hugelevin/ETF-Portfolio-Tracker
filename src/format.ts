export function formatMoney(value: number | null, currency = "EUR"): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatNumber(value: number, maximumFractionDigits = 4): string {
  if (!Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatPercentInBrackets(value: number | null): string {
  const formatted = formatPercent(value);
  return formatted === "Unavailable" ? formatted : `(${formatted})`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function toLocalIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatUpdateAge(value: string | null, now = Date.now()): string {
  if (!value) return "Not Updated";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Update Time Unknown";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "Updated Just Now";
  if (minutes < 60) return `Updated ${minutes} Min Ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} Hr Ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} Day${days === 1 ? "" : "s"} Ago`;
}
