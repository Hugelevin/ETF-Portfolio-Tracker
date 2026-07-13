export const DEFAULT_EODHD_SYMBOLS = [
  "ANAU.MI",
  "SPYY.XETRA",
  "VVSM.XETRA",
  "JEDI.XETRA",
  "VWCE.XETRA",
  "QUTM.XETRA",
  "VUAA.XETRA",
];

export function isAllowedEodhdSymbol(symbol: string, configured: string[]): boolean {
  const allowed = configured.length ? configured : DEFAULT_EODHD_SYMBOLS;
  return allowed.includes(symbol);
}

export function isValidFromDate(value: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === (month ?? 1) - 1 && parsed.getUTCDate() === day && year! >= 2000 && parsed.getTime() <= today.getTime();
}
