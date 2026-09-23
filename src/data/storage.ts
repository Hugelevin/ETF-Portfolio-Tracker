import { emptyPortfolio, parsePortfolioDocument } from "../domain/schema";
import { VERIFIED_INSTRUMENTS } from "../config/instruments";
import { isMarketRecord } from "../market/service";
import type {
  AppSettings,
  MarketRecord,
  PortfolioDocument,
} from "../types";

const KEYS = {
  portfolio: "etf-tracker.portfolio.v1",
  settings: "etf-tracker.settings.v1",
  legacyManualPrices: "etf-tracker.manual-prices.v1",
  marketCache: "etf-tracker.market-cache.v1",
} as const;
const LEGACY_EODHD_KEY = "etf-tracker.api-key.eodhd.v1";

const defaultSettings: AppSettings = { proxyUrl: "" };

function applyInstrumentDefaults(portfolio: PortfolioDocument): PortfolioDocument {
  const defaults = new Map(VERIFIED_INSTRUMENTS.map((instrument) => [instrument.id, instrument]));
  return {
    ...portfolio,
    instruments: portfolio.instruments.map((instrument) => {
      const verified = defaults.get(instrument.id);
      const identityMatches = verified &&
        instrument.isin === verified.isin &&
        instrument.currency === verified.currency &&
        instrument.assetType === verified.assetType;
      const venueMatches = verified && (
        instrument.exchange === verified.exchange ||
        (instrument.assetType === "FUND" && ["Daily fund NAV", "Moneybase cash fund"].includes(instrument.exchange)) ||
        Boolean(instrument.micCode && verified.micCode && instrument.micCode === verified.micCode)
      );
      if (!verified || !identityMatches || !venueMatches) return instrument;
      return {
        ...instrument,
        name: instrument.name.replaceAll("—", "-"),
        exchange: instrument.assetType === "FUND" && instrument.exchange !== verified.exchange
          ? verified.exchange
          : instrument.exchange,
        yahooSymbol: instrument.yahooSymbol ?? verified.yahooSymbol,
        annualYieldPercentage: instrument.annualYieldPercentage ?? verified.annualYieldPercentage,
      };
    }),
  };
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function createPortfolioStorage(source: Storage | (() => Storage)) {
  // Access the browser getter inside guarded operations too: some privacy modes
  // throw before getItem can even be called.
  const getStorage = () => typeof source === "function" ? source() : source;
  const storage = {
    getItem: (key: string) => getStorage().getItem(key),
    setItem: (key: string, value: string) => getStorage().setItem(key, value),
    removeItem: (key: string) => getStorage().removeItem(key),
  };
  // The removed provider stored its credential separately; erase it during migration.
  try { storage.removeItem(LEGACY_EODHD_KEY); } catch { /* Private-mode storage can be unavailable. */ }
  let loadWarning = "";
  let recoveryJson: string | null = null;
  function read(key: string): string | null {
    try { return storage.getItem(key); }
    catch { loadWarning = "Browser storage is unavailable. Changes cannot be saved on this device."; return null; }
  }
  function writeImportant(key: string, value: string) {
    try { storage.setItem(key, value); }
    catch (error) {
      if (!(error instanceof DOMException) || error.name !== "QuotaExceededError") throw error;
      storage.removeItem(KEYS.marketCache);
      storage.setItem(key, value);
    }
  }
  return {
    getLoadWarning: () => loadWarning,
    getRecoveryJson: () => recoveryJson,
    loadPortfolio(): PortfolioDocument {
      recoveryJson = read(`${KEYS.portfolio}.recovery`);
      if (recoveryJson !== null) loadWarning = "Previous unreadable portfolio data is preserved. Export recovery data before clearing this portfolio.";
      const saved = read(KEYS.portfolio);
      if (saved === null) return emptyPortfolio();
      try {
        return applyInstrumentDefaults(parsePortfolioDocument(JSON.parse(saved)));
      } catch {
        recoveryJson = saved;
        loadWarning = "Saved portfolio could not be read. Export recovery data or import a backup. The original is still saved.";
        return emptyPortfolio();
      }
    },
    savePortfolio(portfolio: PortfolioDocument): PortfolioDocument {
      const validated = applyInstrumentDefaults(parsePortfolioDocument(portfolio));
      // Preserve unreadable data before an explicit replacement; never silently lose it.
      if (recoveryJson !== null) writeImportant(`${KEYS.portfolio}.recovery`, recoveryJson);
      writeImportant(KEYS.portfolio, JSON.stringify(validated));
      loadWarning = recoveryJson !== null ? "Previous unreadable portfolio data is preserved. Export recovery data before clearing this portfolio." : "";
      return validated;
    },
    clearPortfolio(): void {
      storage.removeItem(KEYS.marketCache);
      storage.removeItem(KEYS.legacyManualPrices);
      storage.removeItem(`${KEYS.portfolio}.recovery`);
      storage.removeItem(KEYS.portfolio);
      recoveryJson = null;
      loadWarning = "";
    },
    loadSettings(): AppSettings {
      const publicSettings = parseJson<Partial<AppSettings> | null>(
        read(KEYS.settings),
        {},
      );
      return {
        proxyUrl:
          typeof publicSettings?.proxyUrl === "string"
            ? publicSettings.proxyUrl
            : defaultSettings.proxyUrl,
      };
    },
    saveSettings(settings: AppSettings): void {
      writeImportant(
        KEYS.settings,
        JSON.stringify({ proxyUrl: settings.proxyUrl.trim() }),
      );
    },
    loadMarketCache(): Record<string, MarketRecord> {
      const value = parseJson<unknown>(read(KEYS.marketCache), {});
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value).filter(([, record]) => isMarketRecord(record)));
    },
    saveMarketCache(cache: Record<string, MarketRecord>): boolean {
      // Prices are disposable; reserve storage for orders and never let a full
      // cache break a successful refresh or prevent portfolio persistence.
      const entries = Object.entries(cache).sort(([, a], [, b]) => Date.parse(b.quote.fetchedAt) - Date.parse(a.quote.fetchedAt));
      const bounded: Record<string, MarketRecord> = {};
      let size = 0;
      for (const [key, record] of entries) {
        const recordSize = JSON.stringify(record).length + key.length + 4;
        if (size + recordSize > 1_500_000) continue;
        bounded[key] = record;
        size += recordSize;
      }
      try { storage.setItem(KEYS.marketCache, JSON.stringify(bounded)); return true; }
      catch { return false; }
    },
  };
}

export function exportPortfolioJson(portfolio: PortfolioDocument): string {
  return JSON.stringify(parsePortfolioDocument(portfolio), null, 2);
}

export function importPortfolioJson(json: string): PortfolioDocument {
  return parsePortfolioDocument(JSON.parse(json) as unknown);
}
