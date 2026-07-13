import { emptyPortfolio, parsePortfolioDocument } from "../domain/schema";
import { VERIFIED_INSTRUMENTS } from "../config/instruments";
import type {
  AppSettings,
  ManualPrice,
  MarketRecord,
  PortfolioDocument,
} from "../types";

const KEYS = {
  portfolio: "etf-tracker.portfolio.v1",
  settings: "etf-tracker.settings.v1",
  manualPrices: "etf-tracker.manual-prices.v1",
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

export function createPortfolioStorage(storage: Storage) {
  // The removed provider stored its credential separately; erase it during migration.
  storage.removeItem(LEGACY_EODHD_KEY);
  return {
    loadPortfolio(): PortfolioDocument {
      const raw = parseJson<unknown>(storage.getItem(KEYS.portfolio), null);
      if (raw === null) return emptyPortfolio();
      try {
        return applyInstrumentDefaults(parsePortfolioDocument(raw));
      } catch {
        return emptyPortfolio();
      }
    },
    savePortfolio(portfolio: PortfolioDocument): PortfolioDocument {
      const validated = applyInstrumentDefaults(parsePortfolioDocument(portfolio));
      storage.setItem(KEYS.portfolio, JSON.stringify(validated));
      return validated;
    },
    clearPortfolio(): void {
      storage.removeItem(KEYS.portfolio);
      storage.removeItem(KEYS.marketCache);
      storage.removeItem(KEYS.manualPrices);
    },
    loadSettings(): AppSettings {
      const publicSettings = parseJson<Partial<AppSettings>>(
        storage.getItem(KEYS.settings),
        {},
      );
      return {
        proxyUrl:
          typeof publicSettings.proxyUrl === "string"
            ? publicSettings.proxyUrl
            : defaultSettings.proxyUrl,
      };
    },
    saveSettings(settings: AppSettings): void {
      storage.setItem(
        KEYS.settings,
        JSON.stringify({ proxyUrl: settings.proxyUrl.trim() }),
      );
    },
    loadManualPrices(): Record<string, ManualPrice> {
      return parseJson(storage.getItem(KEYS.manualPrices), {});
    },
    saveManualPrices(prices: Record<string, ManualPrice>): void {
      storage.setItem(KEYS.manualPrices, JSON.stringify(prices));
    },
    loadMarketCache(): Record<string, MarketRecord> {
      return parseJson(storage.getItem(KEYS.marketCache), {});
    },
    saveMarketCache(cache: Record<string, MarketRecord>): void {
      storage.setItem(KEYS.marketCache, JSON.stringify(cache));
    },
  };
}

export function exportPortfolioJson(portfolio: PortfolioDocument): string {
  return JSON.stringify(parsePortfolioDocument(portfolio), null, 2);
}

export function importPortfolioJson(json: string): PortfolioDocument {
  return parsePortfolioDocument(JSON.parse(json) as unknown);
}
