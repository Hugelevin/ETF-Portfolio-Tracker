const moneyFormatters = new Map<string, Intl.NumberFormat>();
const numberFormatters = new Map<number, Intl.NumberFormat>();
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

export function formatMoney(value: number | null, currency = "EUR"): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  try {
    let formatter = moneyFormatters.get(currency);
    if (!formatter) {
      formatter = new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (moneyFormatters.size >= 16) moneyFormatters.clear();
      moneyFormatters.set(currency, formatter);
    }
    return formatter.format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatSignedMoney(value: number | null, currency = "EUR"): string {
  const formatted = formatMoney(value, currency);
  return value !== null && Number.isFinite(value) && value > 0 ? `+${formatted}` : formatted;
}

export function formatNumber(value: number, maximumFractionDigits = 4): string {
  if (!Number.isFinite(value)) return "Unavailable";
  const digits = Number.isFinite(maximumFractionDigits) ? Math.max(0, Math.min(20, Math.trunc(maximumFractionDigits))) : 4;
  let formatter = numberFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits });
    numberFormatters.set(digits, formatter);
  }
  return formatter.format(value);
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
  return dateTimeFormatter.format(date);
}

export function formatDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return dateFormatter.format(date);
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
