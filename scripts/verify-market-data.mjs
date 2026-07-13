import { readFile } from "node:fs/promises";

const [file = "outputs/private-portfolio-import-template.json", proxy = ""] = process.argv.slice(2);
const portfolio = JSON.parse(await readFile(file, "utf8"));
if (!Array.isArray(portfolio.instruments)) throw new Error("Template has no instruments array");

const results = [];
for (const instrument of portfolio.instruments) {
  if (!instrument.yahooSymbol) {
    results.push({ ticker: instrument.ticker, isin: instrument.isin, symbol: "APY estimate", ok: true, providerVenue: "Moneybase", currency: instrument.currency, latestTimestamp: null, error: null });
    continue;
  }
  const base = proxy
    ? `${proxy.replace(/\/$/, "")}/yahoo/chart?symbol=${encodeURIComponent(instrument.yahooSymbol)}&range=5d&interval=5m`
    : `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(instrument.yahooSymbol)}?range=5d&interval=5m&events=history`;
  try {
    const response = await fetch(base, { headers: { Accept: "application/json", "User-Agent": "EUR-Portfolio-Tracker-Verification/1.0" } });
    const payload = await response.json();
    const chart = payload?.chart?.result?.[0];
    const meta = chart?.meta;
    const closes = chart?.indicators?.quote?.[0]?.close ?? [];
    const latestIndex = closes.findLastIndex((value) => Number.isFinite(value) && value > 0);
    const venue = String(meta?.fullExchangeName ?? meta?.exchangeName ?? "");
    const venueOk = (instrument.exchange === "Xetra" && /xetra/i.test(venue)) ||
      (instrument.exchange === "Milan" && /(milan|italy)/i.test(venue));
    const typeOk = meta?.instrumentType === "ETF";
    const ok = response.ok && meta?.symbol === instrument.yahooSymbol && meta?.currency === instrument.currency && venueOk && typeOk && latestIndex >= 0;
    results.push({ ticker: instrument.ticker, isin: instrument.isin, symbol: instrument.yahooSymbol, ok, providerVenue: venue, currency: meta?.currency, latestTimestamp: latestIndex >= 0 ? new Date(chart.timestamp[latestIndex] * 1000).toISOString() : null, error: ok ? null : "identity or price validation failed" });
  } catch (error) {
    results.push({ ticker: instrument.ticker, isin: instrument.isin, symbol: instrument.yahooSymbol, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

console.table(results.map(({ ticker, symbol, ok, providerVenue, currency, latestTimestamp, error }) => ({ ticker, symbol, ok, providerVenue, currency, latestTimestamp, error })));
if (results.some((result) => !result.ok)) process.exitCode = 1;
