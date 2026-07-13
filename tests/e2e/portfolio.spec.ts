import { expect, test } from "@playwright/test";

const sample = {
  schemaVersion: 1,
  baseCurrency: "EUR",
  instruments: [{ id: "jedi-xetra-eur", name: "VanEck Space Innovators UCITS ETF", ticker: "JEDI", isin: "IE000YU9K6K2", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "JEDI.DE" }],
  lots: [{ id: "lot-1", instrumentId: "jedi-xetra-eur", shares: 25, pricePerShare: 76.8, purchaseDate: "2026-01-02", fees: 0 }],
};

test.beforeEach(async ({ page }) => {
  await page.route("http://market.test/yahoo/chart**", async (route) => {
    await route.fulfill({ json: { chart: { error: null, result: [{ meta: { symbol: "JEDI.DE", currency: "EUR", fullExchangeName: "XETRA", instrumentType: "ETF", chartPreviousClose: 79 }, timestamp: [1_783_930_000, 1_783_930_600], indicators: { quote: [{ close: [78, 80] }] } }] } } });
  });
  await page.addInitScript((portfolio) => {
    localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify(portfolio));
    localStorage.setItem("etf-tracker.settings.v1", JSON.stringify({ proxyUrl: "http://market.test" }));
  }, sample);
});

test("shows valued summary, holding and accessible detail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("1 of 1 EUR positions valued")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Holdings" })).toBeVisible();
  await page.getByRole("button", { name: /JEDI VanEck/ }).click();
  await expect(page.getByRole("dialog", { name: /JEDI · VanEck Space/ })).toBeVisible();
  await expect(page.getByText("View Chart Data as a Table")).toBeVisible();
});

test("purchase form is keyboard reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Purchase" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Add a Purchase Lot" })).toBeVisible();
  await expect(page.getByLabel("Find an Instrument")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add a Purchase Lot" })).toBeHidden();
});

test("shows an explicit rate-limit error without inventing a price", async ({ page }) => {
  await page.unroute("http://market.test/yahoo/chart**");
  await page.route("http://market.test/yahoo/chart**", (route) => route.fulfill({ status: 429, json: { error: "daily request allowance reached" } }));
  await page.goto("/");
  await expect(page.getByText(/Market Data Unavailable — Rate limit reached/)).toBeVisible();
  await expect(page.getByText("0 of 1 EUR positions valued")).toBeVisible();
});
