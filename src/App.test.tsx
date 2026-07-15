import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("portfolio dashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("shows an honest empty state and zero price coverage", () => {
    render(<App />);
    expect(screen.getByText("Private - Local to This Browser")).toBeInTheDocument();
    expect(screen.getByText("Portfolio data remains on this device.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build Your Portfolio" })).toBeInTheDocument();
    expect(screen.getByLabelText("0 of 0 EUR positions valued")).toBeInTheDocument();
    expect(screen.getByText("Unavailable", { selector: ".metric-card.primary strong" })).toBeInTheDocument();
  });

  it("records a verified purchase with fees defaulting to zero", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Add First Purchase" }));
    const dialog = screen.getByRole("dialog", { name: "Add an Order" });
    await user.click(within(dialog).getByRole("radio", { name: /ANAU/ }));
    await user.type(within(dialog).getByLabelText("Shares"), "25");
    await user.type(within(dialog).getByLabelText("Purchase Price per Share"), "76.8");
    fireEvent.change(within(dialog).getByLabelText("Purchase Date"), { target: { value: "2026-01-02" } });
    expect(within(dialog).getAllByText("€", { selector: ".currency-input > span" })).toHaveLength(2);
    expect(within(dialog).queryByText(/Commission only/i)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Add Purchase" }));
    expect(screen.getByRole("heading", { name: "Holdings" })).toBeInTheDocument();
    expect(screen.getByText("ANAU", { selector: "td strong" })).toBeInTheDocument();
    expect(window.localStorage.getItem("etf-tracker.portfolio.v1")).toContain('"fees":0');
  });

  it("requires confirmation before clearing portfolio data", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Load Public Sample" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Clear Portfolio" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Holdings" })).toBeInTheDocument();
  });

  it("validates an import and previews replacement before applying it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const input = screen.getByLabelText("Import JSON");
    const json = JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [], lots: [] });
    const file = new File([json], "portfolio.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => json });
    await user.upload(input, file);
    const preview = await screen.findByRole("alertdialog", { name: "Import This Portfolio?" });
    expect(within(preview).getByText(/0 instruments/)).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: "Replace Portfolio" })).toBeInTheDocument();
  });

  it("labels persisted market data as stale cache on load", () => {
    const instrument = { id: "jedi-xetra-eur", name: "VanEck Space Innovators UCITS ETF", ticker: "JEDI", isin: "IE000YU9K6K2", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "JEDI.DE" };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "lot", instrumentId: instrument.id, shares: 1, pricePerShare: 70, purchaseDate: "2026-01-02", fees: 0 }] }));
    window.localStorage.setItem("etf-tracker.market-cache.v1", JSON.stringify({ "jedi-xetra-eur:1M": { quote: { instrumentId: instrument.id, price: 80, previousClose: 79, currency: "EUR", exchange: "XETRA", asOf: "2026-07-10T10:00:00Z", fetchedAt: "2026-07-10T10:01:00Z", source: "yahoo", label: "Market data", stale: false }, history: [{ timestamp: "2026-07-10T10:00:00Z", close: 80 }] } }));

    render(<App />);

    expect(screen.getAllByText("Cached").length).toBeGreaterThan(0);
  });

  it("hydrates valuation from another range while keeping chart ranges separate", async () => {
    const user = userEvent.setup();
    const instrument = { id: "jedi-xetra-eur", name: "VanEck Space Innovators UCITS ETF", ticker: "JEDI", isin: "IE000YU9K6K2", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "JEDI.DE" };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "lot", instrumentId: instrument.id, shares: 1, pricePerShare: 70, purchaseDate: "2026-01-02", fees: 0 }] }));
    window.localStorage.setItem("etf-tracker.market-cache.v1", JSON.stringify({
      "jedi-xetra-eur:3M": { quote: { instrumentId: instrument.id, price: 61, previousClose: 60, currency: "EUR", exchange: "XETRA", asOf: "2026-06-01T10:00:00Z", fetchedAt: "2026-06-01T10:01:00Z", source: "yahoo", label: "Market data", stale: false }, history: [{ timestamp: "2026-05-25T10:00:00Z", close: 60 }, { timestamp: "2026-06-01T10:00:00Z", close: 61 }] },
      "jedi-xetra-eur:1Y": { quote: { instrumentId: instrument.id, price: 82, previousClose: 81, currency: "EUR", exchange: "XETRA", asOf: "2026-07-13T10:00:00Z", fetchedAt: "2026-07-13T10:01:00Z", source: "yahoo", label: "Market data", stale: false }, history: [{ timestamp: "2025-07-13T10:00:00Z", close: 70 }, { timestamp: "2026-07-13T10:00:00Z", close: 82 }] },
    }));

    render(<App />);

    expect(screen.getAllByText("€82.00").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("1 of 1 EUR positions valued")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Open JEDI details" })[0]!);
    const detail = await screen.findByRole("dialog", { name: /JEDI/ });
    expect(await screen.findByText("Historical market prices are unavailable for this range.")).toBeInTheDocument();
    expect(within(detail).getAllByText("N/A")).toHaveLength(2);
    const oneYear = within(detail).getByRole("button", { name: "1Y" });
    await user.click(oneYear);
    expect(oneYear).toHaveAttribute("aria-pressed", "true");
    await user.click(within(detail).getByRole("button", { name: "1D" }));
    expect(await within(detail).findByText("Historical market prices are unavailable for this range.")).toBeInTheDocument();
  }, 10_000);

  it("shows raw market prices as the default historical chart", async () => {
    const user = userEvent.setup();
    const instrument = { id: "jedi-xetra-eur", name: "VanEck Space Innovators UCITS ETF", ticker: "JEDI", isin: "IE000YU9K6K2", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "JEDI.DE" };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "lot", instrumentId: instrument.id, shares: 25, pricePerShare: 70, purchaseDate: "2026-07-13", fees: 0 }] }));
    window.localStorage.setItem("etf-tracker.market-cache.v1", JSON.stringify({ "jedi-xetra-eur:1W": { quote: { instrumentId: instrument.id, price: 80, previousClose: 79, currency: "EUR", exchange: "XETRA", asOf: "2026-07-13T10:00:00Z", fetchedAt: "2026-07-13T10:01:00Z", source: "yahoo", label: "Market data", stale: false }, history: [{ timestamp: "2026-07-07T10:00:00Z", close: 78 }, { timestamp: "2026-07-13T10:00:00Z", close: 80 }] } }));

    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Open JEDI details" })[0]!);

    expect(await screen.findByRole("heading", { name: "Market Price History" })).toBeInTheDocument();
    expect(screen.queryByText(/Manual Price Fallback/i)).not.toBeInTheDocument();
    await user.click(await screen.findByText("View Chart Data as a Table", {}, { timeout: 5_000 }));
    const table = screen.getByRole("table", { name: "Historical market prices" });
    expect(within(table).getByText("€78.00")).toBeInTheDocument();
    expect(within(table).getByText("07 Jul 2026")).toBeInTheDocument();
    expect(within(table).queryByText("€1,950.00")).not.toBeInTheDocument();
  });

  it("does not present a one-month cache as one-year history", async () => {
    const user = userEvent.setup();
    const instrument = { id: "jedi-xetra-eur", name: "VanEck Space Innovators UCITS ETF", ticker: "JEDI", isin: "IE000YU9K6K2", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "JEDI.DE" };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "lot", instrumentId: instrument.id, shares: 25, pricePerShare: 70, purchaseDate: "2026-01-02", fees: 0 }] }));
    window.localStorage.setItem("etf-tracker.market-cache.v1", JSON.stringify({ "jedi-xetra-eur:1M": { quote: { instrumentId: instrument.id, price: 80, previousClose: 79, currency: "EUR", exchange: "XETRA", asOf: "2026-07-13T10:00:00Z", fetchedAt: "2026-07-13T10:01:00Z", source: "yahoo", label: "Market data", stale: false }, history: [{ timestamp: "2026-06-13T10:00:00Z", close: 78 }, { timestamp: "2026-07-13T10:00:00Z", close: 80 }] } }));

    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Open JEDI details" })[0]!);
    const detail = screen.getByRole("dialog", { name: /JEDI/ });
    await user.click(await within(detail).findByRole("button", { name: "1Y" }));

    expect(await screen.findByText("Historical market prices are unavailable for this range.")).toBeInTheDocument();
  });

  it("automatically dismisses update notifications after 5 seconds", () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Load Public Sample" }));
    expect(screen.getByText("Public VanEck sample loaded.")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));

    expect(screen.queryByText("Public VanEck sample loaded.")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("does not use a stored APY as a fund valuation when NAV is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
    const instrument = { id: "ummepsa-nav-eur", name: "UBS (Irl) Select Money Market Fund - EUR P Acc", ticker: "UMMEPSA", isin: "IE00BWWCR731", exchange: "Daily fund NAV", currency: "EUR", assetType: "FUND", yahooSymbol: "0P0001CD0Q.F" };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "cash", instrumentId: instrument.id, shares: 10, pricePerShare: 100, purchaseDate: "2026-06-01", fees: 0 }] }));

    render(<App />);

    expect(screen.getAllByLabelText("Market status: Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText("2.28% APY")).not.toBeInTheDocument();
    expect(screen.queryByText("€100.20")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("uses cached fund NAV and shows Moneybase-style market return before fees", () => {
    const instrument = { id: "ummepsa-nav-eur", name: "UBS (Irl) Select Money Market Fund - EUR P Acc", ticker: "UMMEPSA", isin: "IE00BWWCR731", exchange: "Moneybase Cash Fund", currency: "EUR", assetType: "FUND", yahooSymbol: "0P0001CD0Q.F", annualYieldPercentage: 2.28 };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "cash", instrumentId: instrument.id, shares: 10, pricePerShare: 100, purchaseDate: "2026-06-01", fees: 0 }] }));
    window.localStorage.setItem("etf-tracker.market-cache.v1", JSON.stringify({ "ummepsa-nav-eur:1M": { quote: { instrumentId: instrument.id, price: 100.2, previousClose: 100.19, currency: "EUR", exchange: "Daily Fund NAV", asOf: "2026-07-10T08:00:00Z", fetchedAt: "2026-07-10T08:01:00Z", source: "yahoo", label: "Fund NAV", stale: false }, history: [{ timestamp: "2026-07-03T08:00:00Z", close: 100.1 }, { timestamp: "2026-07-10T08:00:00Z", close: 100.2 }] } }));

    render(<App />);

    expect(screen.getByText("€100.20")).toBeInTheDocument();
    expect(screen.getAllByText("€2.00").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Current APY/i)).not.toBeInTheDocument();
  });

  it("keeps broker fees separate from invested capital and market return", () => {
    const instrument = { id: "jedi-xetra-eur", name: "VanEck Space Innovators UCITS ETF", ticker: "JEDI", isin: "IE000YU9K6K2", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "JEDI.DE" };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "lot", instrumentId: instrument.id, shares: 2, pricePerShare: 70, purchaseDate: "2026-01-02", fees: 5 }] }));
    window.localStorage.setItem("etf-tracker.market-cache.v1", JSON.stringify({ "jedi-xetra-eur:1M": { quote: { instrumentId: instrument.id, price: 80, previousClose: 79, currency: "EUR", exchange: "XETRA", asOf: "2026-07-10T10:00:00Z", fetchedAt: "2026-07-10T10:01:00Z", source: "yahoo", label: "Market data", stale: false }, history: [{ timestamp: "2026-07-10T10:00:00Z", close: 80 }] } }));

    render(<App />);

    const summary = screen.getByRole("region", { name: "Your EUR Portfolio" });
    expect(within(summary).getByText("€140.00")).toBeInTheDocument();
    expect(within(summary).getByText("Fees: €5.00")).toBeInTheDocument();
    expect(within(summary).getByText("€20.00")).toBeInTheDocument();
    expect(within(summary).getByText("+14.29% - Before Fees")).toBeInTheDocument();
    expect(within(summary).queryByText("(+14.29%) - Before Fees")).not.toBeInTheDocument();
    expect(within(summary).queryByText(/Net After Fees/i)).not.toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Price" })).toBeInTheDocument();
    expect(within(table).queryByText("Price / NAV")).not.toBeInTheDocument();
    expect(within(table).queryByText("Broker Fees Paid: €5.00")).not.toBeInTheDocument();
  });

  it("uses neutral market wording and Yahoo-only settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByText(/best[- ]effort/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Market data with source and update time shown.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(within(dialog).queryByLabelText(/EODHD/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Yahoo Finance/)).toBeInTheDocument();
  });

  it("automatically calculates the cash-fund annualised NAV yield", async () => {
    const user = userEvent.setup();
    const instrument = { id: "ummepsa-nav-eur", name: "UBS (Irl) Select Money Market Fund - EUR P Acc", ticker: "UMMEPSA", isin: "IE00BWWCR731", exchange: "Moneybase Cash Fund", currency: "EUR", assetType: "FUND", yahooSymbol: "0P0001CD0Q.F", annualYieldPercentage: 2.28 };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "cash", instrumentId: instrument.id, shares: 10, pricePerShare: 100, purchaseDate: "2026-06-01", fees: 0 }] }));
    window.localStorage.setItem("etf-tracker.market-cache.v1", JSON.stringify({ "ummepsa-nav-eur:1M": { quote: { instrumentId: instrument.id, price: 100.2, previousClose: 100.19, currency: "EUR", exchange: "Daily Fund NAV", asOf: "2026-07-10T08:00:00Z", fetchedAt: "2026-07-10T08:01:00Z", source: "yahoo", label: "Fund NAV", stale: false }, history: [{ timestamp: "2026-07-03T08:00:00Z", close: 100.1 }, { timestamp: "2026-07-10T08:00:00Z", close: 100.2 }] } }));
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "Open UMMEPSA details" })[0]!);
    const dialog = screen.getByRole("dialog", { name: /UMMEPSA/ });
    expect(await within(dialog).findByText("7-Day Annualised NAV Yield")).toBeInTheDocument();
    expect(within(dialog).getByText("+5.34%")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Moneybase's advertised APY/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("APY (%)")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "1D" }));
    expect(within(dialog).getByText("+5.34%")).toBeInTheDocument();
  });

  it("does not present a missing fund APY as a real zero rate", () => {
    const instrument = { id: "other-fund", name: "Other cash fund", ticker: "CASH", isin: "IE00BWWCR731", exchange: "Another venue", currency: "EUR", assetType: "FUND" };
    window.localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify({ schemaVersion: 1, baseCurrency: "EUR", instruments: [instrument], lots: [{ id: "cash", instrumentId: instrument.id, shares: 1, pricePerShare: 100, purchaseDate: "2026-01-01", fees: 0 }] }));

    render(<App />);

    expect(screen.getAllByLabelText("Market status: Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText("0% APY")).not.toBeInTheDocument();
  });
});
