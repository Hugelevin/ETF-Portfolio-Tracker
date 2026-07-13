import { expect, test } from "@playwright/test";

const sample = {
  schemaVersion: 1,
  baseCurrency: "EUR",
  instruments: [{ id: "jedi-xetra-eur", name: "VanEck Space Innovators UCITS ETF", ticker: "JEDI", isin: "IE000YU9K6K2", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "JEDI.DE" }],
  lots: [{ id: "lot-1", instrumentId: "jedi-xetra-eur", shares: 25, pricePerShare: 76.8, purchaseDate: "2026-01-02", fees: 0 }],
};

test.beforeEach(async ({ page }) => {
  await page.route("http://market.test/yahoo/chart**", async (route) => {
    const range = new URL(route.request().url()).searchParams.get("range");
    const timestamps = range === "1y"
      ? [Date.parse("2025-08-01T09:00:00Z"), Date.parse("2026-02-02T09:00:00Z"), Date.parse("2026-07-13T09:00:00Z")].map((value) => value / 1_000)
      : [Date.parse("2026-07-13T10:00:00Z"), Date.parse("2026-07-13T10:10:00Z")].map((value) => value / 1_000);
    const closes = range === "1y" ? [60, 70, 79] : [78, 80];
    await route.fulfill({ json: { chart: { error: null, result: [{ meta: { symbol: "JEDI.DE", currency: "EUR", fullExchangeName: "XETRA", instrumentType: "ETF", chartPreviousClose: 79 }, timestamp: timestamps, indicators: { quote: [{ close: closes }] } }] } } });
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
  await page.getByRole("button", { name: "Edit order from 2026-01-02" }).click();
  await expect(page.getByRole("dialog", { name: "Edit Order" })).toBeVisible();
  await expect(page.getByLabel("Shares")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Edit Order" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Close details" })).toBeVisible();
});

test("purchase form is keyboard reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Purchase" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Add an Order" })).toBeVisible();
  await expect(page.getByLabel("Find an Instrument")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add an Order" })).toBeHidden();
});

test("loads a distinct one-year series and compares value after the first order", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open JEDI details" }).click();
  await page.getByRole("button", { name: "1Y" }).click();
  await expect(page.getByRole("img", { name: "Historical market price chart with 3 data points" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("€80.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Value vs Invested" }).click();
  await expect(page.getByRole("img", { name: "Historical position value and invested cost chart with 2 data points" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
});

test("keeps data actions equal and instrument marks contained", async ({ page }) => {
  await page.goto("/");
  const actions = await page.locator(".data-tools .tool-actions .button").all();
  expect(actions).toHaveLength(3);
  const widths = await Promise.all(actions.map(async (action) => (await action.boundingBox())?.width ?? 0));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);

  const tile = await page.locator(".instrument-logo").first().boundingBox();
  const mark = await page.locator(".instrument-logo img").first().boundingBox();
  expect(tile).not.toBeNull();
  expect(mark).not.toBeNull();
  expect(mark!.width).toBeLessThanOrEqual(tile!.width);
  expect(mark!.height).toBeLessThanOrEqual(tile!.height);
  expect(mark!.width / tile!.width).toBeGreaterThan(.8);
  expect(mark!.height / tile!.height).toBeGreaterThan(.8);
});

test("keeps the mobile brand and add action balanced", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const brand = await page.locator(".brand img").boundingBox();
  const add = await page.getByRole("button", { name: "Add Purchase" }).boundingBox();
  expect(brand).not.toBeNull();
  expect(add).not.toBeNull();
  expect(brand!.width).toBeGreaterThan(170);
  expect(add!.width).toBeGreaterThanOrEqual(44);
  expect(add!.width).toBeLessThanOrEqual(48);
  expect(add!.height).toBe(add!.width);
});

test("shows an explicit rate-limit error without inventing a price", async ({ page }) => {
  await page.unroute("http://market.test/yahoo/chart**");
  await page.route("http://market.test/yahoo/chart**", (route) => route.fulfill({ status: 429, json: { error: "daily request allowance reached" } }));
  await page.goto("/");
  await expect(page.getByText(/Market Data Unavailable - Rate limit reached/)).toBeVisible();
  await expect(page.getByText("0 of 1 EUR positions valued")).toBeVisible();
});
