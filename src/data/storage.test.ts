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

  it("recovers safely from invalid stored JSON", () => {
    const memory = new MemoryStorage();
    memory.setItem("etf-tracker.portfolio.v1", "not-json");

    expect(createPortfolioStorage(memory).loadPortfolio()).toEqual(portfolio);
  });

  it("exports only portfolio data and validates it on import", () => {
    const json = exportPortfolioJson(portfolio);

    expect(json).not.toContain("apiKey");
    expect(importPortfolioJson(json)).toEqual(portfolio);
    expect(() => importPortfolioJson('{"schemaVersion":2}')).toThrow();
  });
});
