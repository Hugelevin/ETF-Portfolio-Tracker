import { readFile } from "node:fs/promises";

const [file = "outputs/private-portfolio-import-template.json", proxy = ""] = process.argv.slice(2);
async function loadTypeScriptModule(relativePath) {
  const ts = await import("typescript");
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

async function loadPortfolio() {
  if (file !== "--catalog") return JSON.parse(await readFile(file, "utf8"));
  // The checked-in catalogue contains identities only, never personal orders.
  const { VERIFIED_INSTRUMENTS } = await loadTypeScriptModule("../src/config/instruments.ts");
  return { instruments: VERIFIED_INSTRUMENTS };
}
const portfolio = await loadPortfolio();
const { marketDataSourceInstrument } = await loadTypeScriptModule("../src/market/marketDataSource.ts");
if (!Array.isArray(portfolio.instruments)) throw new Error("Template has no instruments array");

const results = [];
for (const holding of portfolio.instruments) {
  // Validate the actual app data source while keeping the owned ticker in output.
  const instrument = { ...marketDataSourceInstrument(holding), ticker: holding.ticker };
  if (!instrument.yahooSymbol) {
    results.push({ ticker: instrument.ticker, isin: instrument.isin, symbol: "Missing", ok: false, providerVenue: instrument.exchange, currency: instrument.currency, latestTimestamp: null, error: "Yahoo symbol missing" });
    continue;
  }
  const isFund = instrument.assetType === "FUND";
  const interval = isFund ? "1d" : "5m";
  const base = proxy
    ? `${proxy.replace(/\/$/, "")}/yahoo/chart?symbol=${encodeURIComponent(instrument.yahooSymbol)}&range=5d&interval=${interval}`
    : `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(instrument.yahooSymbol)}?range=5d&interval=${interval}&events=history`;
  try {
    const response = await fetch(base, { signal: AbortSignal.timeout(15_000), headers: { Accept: "application/json", "User-Agent": "EUR-Portfolio-Tracker-Verification/1.0" } });
    const payload = await response.json();
    const chart = payload?.chart?.result?.[0];
    const meta = chart?.meta;
    const closes = chart?.indicators?.quote?.[0]?.close ?? [];
    const latestIndex = closes.findLastIndex((value) => Number.isFinite(value) && value > 0);
    const venue = String(meta?.fullExchangeName ?? meta?.exchangeName ?? "");
    const venueOk = isFund || (instrument.exchange === "Xetra" && /xetra/i.test(venue)) ||
      (instrument.exchange === "Milan" && /(milan|italy)/i.test(venue));
    const typeOk = isFund
      ? ["MUTUALFUND", "FUND"].includes(meta?.instrumentType)
      : meta?.instrumentType === "ETF";
    const ok = response.ok && meta?.symbol === instrument.yahooSymbol && meta?.currency === instrument.currency && venueOk && typeOk && latestIndex >= 0;
    results.push({ ticker: instrument.ticker, isin: instrument.isin, symbol: instrument.yahooSymbol, ok, providerVenue: venue, currency: meta?.currency, latestTimestamp: latestIndex >= 0 ? new Date(chart.timestamp[latestIndex] * 1000).toISOString() : null, error: ok ? null : "identity or price validation failed" });
  } catch (error) {
    results.push({ ticker: instrument.ticker, isin: instrument.isin, symbol: instrument.yahooSymbol, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

console.table(results.map(({ ticker, symbol, ok, providerVenue, currency, latestTimestamp, error }) => ({ ticker, symbol, ok, providerVenue, currency, latestTimestamp, error })));
if (results.some((result) => !result.ok)) process.exitCode = 1;
