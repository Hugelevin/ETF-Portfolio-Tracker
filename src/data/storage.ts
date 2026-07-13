import { emptyPortfolio, parsePortfolioDocument } from "../domain/schema";
import type {
  AppSettings,
  ManualPrice,
  MarketRecord,
  PortfolioDocument,
} from "../types";

const KEYS = {
  portfolio: "etf-tracker.portfolio.v1",
  settings: "etf-tracker.settings.v1",
  apiKey: "etf-tracker.api-key.eodhd.v1",
  manualPrices: "etf-tracker.manual-prices.v1",
  marketCache: "etf-tracker.market-cache.v1",
} as const;

const defaultSettings: AppSettings = { proxyUrl: "", eodhdApiKey: "" };

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function createPortfolioStorage(storage: Storage) {
  return {
    loadPortfolio(): PortfolioDocument {
      const raw = parseJson<unknown>(storage.getItem(KEYS.portfolio), null);
      if (raw === null) return emptyPortfolio();
      try {
        return parsePortfolioDocument(raw);
      } catch {
        return emptyPortfolio();
      }
    },
    savePortfolio(portfolio: PortfolioDocument): void {
      const validated = parsePortfolioDocument(portfolio);
      storage.setItem(KEYS.portfolio, JSON.stringify(validated));
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
        eodhdApiKey: storage.getItem(KEYS.apiKey) ?? "",
      };
    },
    saveSettings(settings: AppSettings): void {
      storage.setItem(
        KEYS.settings,
        JSON.stringify({ proxyUrl: settings.proxyUrl.trim() }),
      );
      if (settings.eodhdApiKey) {
        storage.setItem(KEYS.apiKey, settings.eodhdApiKey.trim());
      } else {
        storage.removeItem(KEYS.apiKey);
      }
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
