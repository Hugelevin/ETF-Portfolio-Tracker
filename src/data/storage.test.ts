import { describe, expect, it } from "vitest";
import {
  createPortfolioStorage,
  exportPortfolioJson,
  importPortfolioJson,
} from "./storage";
import type { PortfolioDocument } from "../types";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const portfolio: PortfolioDocument = {
  schemaVersion: 1,
  baseCurrency: "EUR",
  instruments: [],
  lots: [],
};

describe("portfolio storage", () => {
  it("round-trips a versioned portfolio through its public interface", () => {
    const storage = createPortfolioStorage(new MemoryStorage());

    storage.savePortfolio(portfolio);

    expect(storage.loadPortfolio()).toEqual(portfolio);
  });

  it("removes the obsolete EODHD credential during migration", () => {
    const memory = new MemoryStorage();
    memory.setItem("etf-tracker.api-key.eodhd.v1", "secret");

    createPortfolioStorage(memory);

    expect(memory.getItem("etf-tracker.api-key.eodhd.v1")).toBeNull();
  });

  it("recovers safely from invalid stored JSON", () => {
    const memory = new MemoryStorage();
    memory.setItem("etf-tracker.portfolio.v1", "not-json");

    expect(createPortfolioStorage(memory).loadPortfolio()).toEqual(portfolio);
  });

  it("does not apply Moneybase defaults to the same id at another venue", () => {
    const storage = createPortfolioStorage(new MemoryStorage());
    const otherVenue: PortfolioDocument = {
      schemaVersion: 1,
      baseCurrency: "EUR",
      instruments: [{
        id: "ummepsa-nav-eur",
        name: "Imported fund",
        ticker: "OTHER",
        isin: "IE00BWWCR731",
        exchange: "Another venue",
        currency: "EUR",
        assetType: "FUND",
      }],
      lots: [],
    };

    expect(storage.savePortfolio(otherVenue).instruments[0]?.annualYieldPercentage).toBeUndefined();
  });

  it("migrates the legacy UMMEPSA venue label to the Moneybase model", () => {
    const storage = createPortfolioStorage(new MemoryStorage());
    const legacy: PortfolioDocument = {
      schemaVersion: 1,
      baseCurrency: "EUR",
      instruments: [{
        id: "ummepsa-nav-eur",
        name: "UBS (Irl) Select Money Market Fund — EUR P Acc",
        ticker: "UMMEPSA",
        isin: "IE00BWWCR731",
        exchange: "Daily fund NAV",
        currency: "EUR",
        assetType: "FUND",
        yahooSymbol: "0P0001CD0Q.F",
      }],
      lots: [],
    };

    const migrated = storage.savePortfolio(legacy).instruments[0];
    expect(migrated?.name).toBe("UBS (Irl) Select Money Market Fund - EUR P Acc");
    expect(migrated?.exchange).toBe("Moneybase Cash Fund");
    expect(migrated?.annualYieldPercentage).toBeUndefined();
    expect(migrated?.yahooSymbol).toBe("0P0001CD0Q.F");
  });

  it("exports only portfolio data and validates it on import", () => {
    const json = exportPortfolioJson(portfolio);

    expect(json).not.toContain("apiKey");
    expect(importPortfolioJson(json)).toEqual(portfolio);
    expect(() => importPortfolioJson('{"schemaVersion":2}')).toThrow();
  });
});
