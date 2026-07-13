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

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function toLocalIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
