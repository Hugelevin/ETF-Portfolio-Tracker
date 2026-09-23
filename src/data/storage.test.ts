import { describe, expect, it, vi } from "vitest";
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

  it.each(["null", "[]", "42", '{"broken":null}', '{"broken":{"history":[null]}}'])("ignores malformed market cache %s", (value) => {
    const memory = new MemoryStorage();
    memory.setItem("etf-tracker.market-cache.v1", value);
    expect(createPortfolioStorage(memory).loadMarketCache()).toEqual({});
  });

  it("preserves unreadable orders and makes the raw file recoverable", () => {
    const memory = new MemoryStorage();
    memory.setItem("etf-tracker.portfolio.v1", "damaged original");
    const storage = createPortfolioStorage(memory);
    storage.loadPortfolio();
    expect(storage.getLoadWarning()).toMatch(/could not be read/);
    expect(storage.getRecoveryJson()).toBe("damaged original");
    storage.savePortfolio(portfolio);
    expect(memory.getItem("etf-tracker.portfolio.v1.recovery")).toBe("damaged original");
    expect(storage.getRecoveryJson()).toBe("damaged original");
    const reopened = createPortfolioStorage(memory);
    expect(reopened.loadPortfolio()).toEqual(portfolio);
    expect(reopened.getRecoveryJson()).toBe("damaged original");
    expect(reopened.getLoadWarning()).toMatch(/recovery/i);
  });

  it("keeps cache quota failures separate from portfolio writes", () => {
    const memory = new MemoryStorage();
    const storage = createPortfolioStorage(memory);
    vi.spyOn(memory, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(storage.saveMarketCache({})).toBe(false);
    expect(() => storage.savePortfolio(portfolio)).toThrow();
  });

  it("tolerates storage blocked by the browser", () => {
    const memory = new MemoryStorage();
    vi.spyOn(memory, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    vi.spyOn(memory, "removeItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    const storage = createPortfolioStorage(memory);
    expect(storage.loadPortfolio()).toEqual(portfolio);
    expect(storage.loadSettings()).toEqual({ proxyUrl: "" });
    expect(storage.getLoadWarning()).toMatch(/unavailable/);
  });

  it("handles a browser that blocks even obtaining localStorage", () => {
    const getStorage = vi.fn(() => { throw new DOMException("Denied", "SecurityError"); });
    const storage = createPortfolioStorage(getStorage);
    expect(storage.loadPortfolio()).toEqual(portfolio);
    expect(getStorage).toHaveBeenCalled();
    expect(storage.getLoadWarning()).toMatch(/unavailable/);
    expect(() => storage.savePortfolio(portfolio)).toThrow();
  });

  it("evicts only disposable quotes before retrying a portfolio quota failure", () => {
    const memory = new MemoryStorage();
    memory.setItem("etf-tracker.market-cache.v1", "large cache");
    memory.setItem("unrelated-app", "keep");
    const originalSet = memory.setItem.bind(memory);
    vi.spyOn(memory, "setItem").mockImplementation((key, value) => {
      if (key === "etf-tracker.portfolio.v1" && memory.getItem("etf-tracker.market-cache.v1")) throw new DOMException("Full", "QuotaExceededError");
      originalSet(key, value);
    });
    const storage = createPortfolioStorage(memory);
    expect(storage.savePortfolio(portfolio)).toEqual(portfolio);
    expect(memory.getItem("etf-tracker.market-cache.v1")).toBeNull();
    expect(memory.getItem("unrelated-app")).toBe("keep");
  });

  it("clears in-memory recovery state after the user explicitly clears the portfolio", () => {
    const memory = new MemoryStorage();
    memory.setItem("etf-tracker.portfolio.v1", "damaged original");
    const storage = createPortfolioStorage(memory);
    storage.loadPortfolio();
    storage.clearPortfolio();
    expect(storage.getRecoveryJson()).toBeNull();
    expect(storage.getLoadWarning()).toBe("");
    storage.savePortfolio(portfolio);
    expect(memory.getItem("etf-tracker.portfolio.v1.recovery")).toBeNull();
  });
});
