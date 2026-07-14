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
  await expect(page.getByLabel("1 of 1 EUR positions valued")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Holdings" })).toBeVisible();
  await page.getByRole("button", { name: /JEDI VanEck/ }).click();
  await expect(page.getByRole("dialog", { name: /JEDI · VanEck Space/ })).toBeVisible();
  await expect(page.getByText("View Chart Data as a Table")).toBeVisible();
  const desktopEdit = page.getByRole("button", { name: "Edit order from 2026-01-02" });
  if (await desktopEdit.isVisible()) {
    await desktopEdit.click();
  } else {
    await page.getByLabel("Order actions for 2026-01-02").click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
  }
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
  const priceChart = page.getByRole("img", { name: "Historical market price chart with 3 data points and average buy price baseline" });
  await expect(priceChart).toBeVisible();
  await expect(page.getByText(/Average Buy €76.80/)).toBeVisible();
  await priceChart.scrollIntoViewIfNeeded();
  const chartBox = await priceChart.boundingBox();
  expect(chartBox).not.toBeNull();
  await page.mouse.move(chartBox!.x + chartBox!.width * .65, chartBox!.y + chartBox!.height * .55);
  const tooltip = page.locator(".chart-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Price");
  await expect(tooltip).toContainText("Holding Value");
  await expect(tooltip).toContainText("Change");
  await expect(page.getByRole("dialog").getByText("€80.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Holding Value" }).click();
  await expect(page.getByRole("img", { name: "Historical holding value and invested cost chart with 2 data points" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Holding Value vs Invested Cost" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(page.getByText("1 Order")).toBeVisible();
});

test("keeps data actions equal and instrument marks contained", async ({ page }) => {
  await page.goto("/");
  const actions = await page.locator(".data-tools .tool-actions .button").all();
  expect(actions).toHaveLength(3);
  const widths = await Promise.all(actions.map(async (action) => (await action.boundingBox())?.width ?? 0));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);

  const tile = await page.locator(".instrument-logo:visible").first().boundingBox();
  const mark = await page.locator(".instrument-logo:visible img").first().boundingBox();
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
  expect(add!.width).toBeGreaterThanOrEqual(72);
  expect(add!.width).toBeLessThanOrEqual(90);
  expect(add!.height).toBeGreaterThanOrEqual(44);
});

test("keeps the primary mobile controls touch friendly and compact", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const toastClose = await page.getByRole("button", { name: "Dismiss notification" }).boundingBox();
  expect(toastClose).not.toBeNull();
  expect(toastClose!.width).toBeGreaterThanOrEqual(44);
  expect(toastClose!.height).toBeGreaterThanOrEqual(44);

  const logoTile = await page.locator(".instrument-logo:visible").first().boundingBox();
  const logoMark = await page.locator(".instrument-logo:visible img").first().boundingBox();
  expect(logoTile).not.toBeNull();
  expect(logoMark).not.toBeNull();
  expect(logoMark!.width / logoTile!.width).toBeGreaterThan(.96);
  expect(logoMark!.height / logoTile!.height).toBeGreaterThan(.96);

  await page.getByRole("button", { name: "Open JEDI details" }).click();
  await expect(page.getByText("View Chart Data as a Table")).toBeVisible();
  await expect(page.getByText(/Manual Price Fallback/i)).toHaveCount(0);

  for (const name of ["Price", "Holding Value", "1D", "1W", "1M", "3M", "1Y", "MAX"]) {
    const control = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(control).not.toBeNull();
    expect(control!.height).toBeGreaterThanOrEqual(44);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test("does not overflow on the narrowest supported phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await expect(page.getByRole("button", { name: "Add Purchase" })).toBeVisible();
});

test("keeps the full-screen detail usable in phone landscape", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open JEDI details" }).click();

  const close = await page.getByRole("button", { name: "Close details" }).boundingBox();
  expect(close).not.toBeNull();
  expect(close!.x).toBeGreaterThanOrEqual(0);
  expect(close!.x + close!.width).toBeLessThanOrEqual(844);
  expect(close!.y).toBeGreaterThanOrEqual(0);
  expect(close!.height).toBeGreaterThanOrEqual(44);
});

test("shows an explicit rate-limit error without inventing a price", async ({ page }) => {
  await page.unroute("http://market.test/yahoo/chart**");
  await page.route("http://market.test/yahoo/chart**", (route) => route.fulfill({ status: 429, json: { error: "daily request allowance reached" } }));
  await page.goto("/");
  await expect(page.locator(".status.unavailable:visible").first()).toBeVisible();
  await expect(page.locator(".fallback-reason:visible").first()).toContainText("Rate limit reached");
  await expect(page.getByLabel("0 of 1 EUR positions valued")).toBeVisible();
});

test("filters and searches holdings from the compact toolbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByPlaceholder("Search holdings")).toBeVisible();
  await expect(page.locator("#holdings-sort")).toHaveValue("value");
  await page.getByRole("button", { name: "Losers" }).click();
  await expect(page.getByText("No holdings match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Gainers" }).click();
  await expect(page.locator(".holding-card:visible").getByText("JEDI", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Search holdings").fill("missing ticker");
  await expect(page.getByText("No holdings match these filters.")).toBeVisible();
});

test("browser back closes detail and purchase sheets before leaving dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dashboardUrl = page.url();

  await page.getByRole("button", { name: "Open JEDI details" }).click();
  await expect(page.getByRole("dialog", { name: /JEDI/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: /JEDI/ })).toBeHidden();
  expect(page.url()).toBe(dashboardUrl);

  await page.getByRole("button", { name: "Add Purchase" }).click();
  await expect(page.getByRole("dialog", { name: "Add an Order" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Add an Order" })).toBeHidden();
  expect(page.url()).toBe(dashboardUrl);
});

test("uses mobile order cards without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open JEDI details" }).click();

  await expect(page.getByText("1 Order")).toBeVisible();
  await expect(page.getByLabel("Order actions for 2026-01-02")).toBeVisible();
  await expect(page.locator(".order-card:visible").getByText("Purchase Price", { exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
