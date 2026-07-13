import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("portfolio dashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows an honest empty state and zero price coverage", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Build your private portfolio" })).toBeInTheDocument();
    expect(screen.getByText("0 of 0 EUR positions valued")).toBeInTheDocument();
    expect(screen.getByText("Unavailable", { selector: ".metric-card.primary strong" })).toBeInTheDocument();
  });

  it("records a verified purchase with fees defaulting to zero", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Add first purchase" }));
    const dialog = screen.getByRole("dialog", { name: "Add a purchase lot" });
    await user.type(within(dialog).getByLabelText("Shares / units"), "25");
    await user.type(within(dialog).getByLabelText("Purchase price per share / unit"), "76.8");
    fireEvent.change(within(dialog).getByLabelText("Purchase date"), { target: { value: "2026-01-02" } });
    await user.click(within(dialog).getByRole("button", { name: "Add purchase" }));
    expect(screen.getByRole("heading", { name: "Holdings" })).toBeInTheDocument();
    expect(screen.getByText("ANAU", { selector: "td strong" })).toBeInTheDocument();
    expect(window.localStorage.getItem("etf-tracker.portfolio.v1")).toContain('"fees":0');
  });

  it("requires confirmation before clearing portfolio data", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Load public sample" }));
    await user.click(screen.getByRole("button", { name: "Clear portfolio" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Holdings" })).toBeInTheDocument();
  });

  it("validates an import and previews replacement before applying it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText("Import JSON");
    const json = JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [], lots: [] });
    const file = new File([json], "portfolio.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => json });
    await user.upload(input, file);
    const preview = await screen.findByRole("alertdialog", { name: "Import this portfolio?" });
    expect(within(preview).getByText(/0 instruments/)).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: "Replace portfolio" })).toBeInTheDocument();
  });

  it("labels persisted market data as stale cache on load", () => {
    const instrument = { id: "jedi-xetra-eur", name: "VanEck Space Innovators UCITS ETF", ticker: "JEDI", isin: "IE000YU9K6K2", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "JEDI.DE" };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "lot", instrumentId: instrument.id, shares: 1, pricePerShare: 70, purchaseDate: "2026-01-02", fees: 0 }] }));
    window.localStorage.setItem("etf-tracker.market-cache.v1", JSON.stringify({ "jedi-xetra-eur:1M": { quote: { instrumentId: instrument.id, price: 80, previousClose: 79, currency: "EUR", exchange: "XETRA", asOf: "2026-07-10T10:00:00Z", fetchedAt: "2026-07-10T10:01:00Z", source: "yahoo", label: "Market data", stale: false }, history: [{ timestamp: "2026-07-10T10:00:00Z", close: 80 }] } }));

    render(<App />);

    expect(screen.getByText("Previous update")).toBeInTheDocument();
  });

  it("values the Moneybase cash fund from its configurable APY without Yahoo NAV", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
    const instrument = { id: "ummepsa-nav-eur", name: "UBS (Irl) Select Money Market Fund — EUR P Acc", ticker: "UMMEPSA", isin: "IE00BWWCR731", exchange: "Daily fund NAV", currency: "EUR", assetType: "FUND", yahooSymbol: "0P0001CD0Q.F" };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "cash", instrumentId: instrument.id, shares: 74.0761, pricePerShare: 10.13, purchaseDate: "2025-06-13", fees: 0 }] }));

    render(<App />);

    expect(screen.getByText("2.28% APY")).toBeInTheDocument();
    expect(screen.queryByText("€106.39")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("uses neutral market wording and Yahoo-only settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByText(/best[- ]effort/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(within(dialog).queryByLabelText(/EODHD/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Yahoo Finance/)).toBeInTheDocument();
  });

  it("lets the user update the cash-fund APY locally", async () => {
    const user = userEvent.setup();
    const instrument = { id: "ummepsa-nav-eur", name: "UBS (Irl) Select Money Market Fund — EUR P Acc", ticker: "UMMEPSA", isin: "IE00BWWCR731", exchange: "Moneybase cash fund", currency: "EUR", assetType: "FUND", annualYieldPercentage: 2.28 };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "cash", instrumentId: instrument.id, shares: 74.0761, pricePerShare: 10.13, purchaseDate: "2025-06-13", fees: 0 }] }));
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open UMMEPSA details" }));
    const dialog = screen.getByRole("dialog", { name: /UMMEPSA/ });
    const input = within(dialog).getByLabelText("APY (%)");
    await user.clear(input);
    await user.type(input, "2.5");
    await user.click(within(dialog).getByRole("button", { name: "Save APY" }));

    expect(window.localStorage.getItem("etf-tracker.portfolio.v1")).toContain('"annualYieldPercentage":2.5');
  });

  it("does not present a missing fund APY as a real zero rate", () => {
    const instrument = { id: "other-fund", name: "Other cash fund", ticker: "CASH", isin: "IE00BWWCR731", exchange: "Another venue", currency: "EUR", assetType: "FUND" };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "cash", instrumentId: instrument.id, shares: 1, pricePerShare: 100, purchaseDate: "2026-01-01", fees: 0 }] }));

    render(<App />);

    expect(screen.getByText("APY required")).toBeInTheDocument();
    expect(screen.queryByText("0% APY")).not.toBeInTheDocument();
  });
});
