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
    const timestamps = range === "max"
      ? ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31"].map((value) => Date.parse(`${value}T09:00:00Z`) / 1_000)
      : range === "1y"
      ? [Date.parse("2025-08-01T09:00:00Z"), Date.parse("2026-02-02T09:00:00Z"), Date.parse("2026-07-13T09:00:00Z")].map((value) => value / 1_000)
      : range === "3mo"
        ? [Date.parse("2026-06-13T09:00:00Z"), Date.parse("2026-07-06T09:00:00Z"), Date.parse("2026-07-13T09:00:00Z")].map((value) => value / 1_000)
        : range === "1mo"
          ? [Date.parse("2026-06-13T09:00:00Z"), Date.parse("2026-07-13T09:00:00Z")].map((value) => value / 1_000)
        : [Date.parse("2026-07-13T10:00:00Z"), Date.parse("2026-07-13T10:10:00Z")].map((value) => value / 1_000);
    const closes = range === "max" ? [100, 80, 100, 120, 90, 108, 132] : range === "1y" ? [60, 70, 79] : range === "3mo" ? [70, 75, 80] : range === "1mo" ? [75, 80] : [78, 80];
    await route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { chart: { error: null, result: [{ meta: { symbol: "JEDI.DE", currency: "EUR", fullExchangeName: "XETRA", instrumentType: "ETF", chartPreviousClose: 79 }, timestamp: timestamps, indicators: { quote: [{ close: closes }] } }] } } });
  });
  await page.addInitScript((portfolio) => {
    localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify(portfolio));
    localStorage.setItem("etf-tracker.settings.v1", JSON.stringify({ proxyUrl: "http://market.test" }));
  }, sample);
});

test("shows valued summary, holding and accessible detail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("1 of 1 EUR positions valued")).toBeVisible();
  await expect(page.locator(".summary")).not.toHaveClass(/loss/);
  await expect(page.getByRole("heading", { name: "Holdings" })).toBeVisible();
  const threeMonthResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("range") === "3mo");
  await page.getByRole("button", { name: /JEDI VanEck/ }).click();
  await threeMonthResponse;
  await expect(page.getByRole("dialog", { name: /JEDI · VanEck Space/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "1W", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".quote-strip > div")).toHaveCount(4);
  const periodPerformance = page.locator(".period-performance");
  await expect(periodPerformance).toContainText("1W");
  await expect(periodPerformance).toContainText("1M");
  await expect(periodPerformance).toContainText("+6.67%");
  await expect(periodPerformance).toContainText("+14.29%");
  await expect(periodPerformance).toContainText("+€5.00");
  await expect(periodPerformance).toContainText("+€10.00");
  await expect(page.locator(".quote-strip").getByText("Market Return", { exact: true })).toBeVisible();
  await expect(page.locator(".market-data-line")).toHaveText(/Source: YAHOO · Data: 13 Jul 2026, \d{2}:10 · Fetched:/);
  await expect(page.locator(".market-data-line")).not.toContainText("XETRA");
  await expect(page.getByText("Market Data Details", { exact: true })).toHaveCount(0);
  await expect(page.getByText("View Chart Data as a Table")).toBeVisible();
  const desktopEdit = page.getByRole("button", { name: "Edit order from 2026-01-02" });
  if (await desktopEdit.isVisible()) {
    await desktopEdit.click();
  } else {
    await page.getByLabel("Order actions for 2026-01-02").click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
  }
  await expect(page.getByRole("dialog", { name: "Edit Order" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close order editor" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Edit Order" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Close details" })).toBeVisible();
});

test("order form is keyboard reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Order" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Add Order" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close order form" })).toBeFocused();
  await expect(page.getByRole("group", { name: "Select Instrument" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add Order" })).toBeHidden();
});

test("loads a distinct one-year series and compares value after the first order", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open JEDI details" }).click();
  await page.getByRole("button", { name: "1D" }).click();
  await expect(page.getByRole("img", { name: "Historical market price chart with 2 data points" })).toBeVisible();
  await expect(page.getByText(/Average Buy €76.80/)).toHaveCount(0);
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
  await expect(tooltip).not.toContainText("Holding Value");
  await expect(tooltip).not.toContainText("Change");
  await expect(page.locator(".quote-strip > div").first().getByText("€80.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Holding Value" }).click();
  const valueChart = page.getByRole("img", { name: "Historical holding value and invested cost chart with 2 data points" });
  await expect(valueChart).toBeVisible();
  const valueChartBox = await valueChart.boundingBox();
  expect(valueChartBox).not.toBeNull();
  await page.mouse.move(valueChartBox!.x + valueChartBox!.width * .7, valueChartBox!.y + valueChartBox!.height * .5);
  await expect(page.locator(".chart-tooltip")).toContainText(/Change.*\([+-]\d/);
  await expect(page.locator(".chart-tooltip .change-separator")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Holding Value vs Invested Cost" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(page.getByText("1 Order", { exact: true })).toBeVisible();
});

test("keeps settings data actions equal and instrument marks contained", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Close settings" })).toBeFocused();
  await expect(page.getByLabel("Cloudflare Worker URL")).not.toBeFocused();
  const actions = await page.locator(".settings-data-actions .button").all();
  expect(actions).toHaveLength(3);
  const widths = await Promise.all(actions.map(async (action) => (await action.boundingBox())?.width ?? 0));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
  const styles = await Promise.all(actions.map((action) => action.evaluate((element) => {
    const style = getComputedStyle(element);
    return { height: element.getBoundingClientRect().height, fontSize: style.fontSize, fontWeight: style.fontWeight };
  })));
  expect(new Set(styles.map((style) => style.height)).size).toBe(1);
  expect(new Set(styles.map((style) => style.fontSize)).size).toBe(1);
  expect(new Set(styles.map((style) => style.fontWeight)).size).toBe(1);

  const tile = await page.locator(".instrument-logo:visible").first().boundingBox();
  const mark = await page.locator(".instrument-logo:visible img").first().boundingBox();
  expect(tile).not.toBeNull();
  expect(mark).not.toBeNull();
  expect(mark!.width).toBeLessThanOrEqual(tile!.width);
  expect(mark!.height).toBeLessThanOrEqual(tile!.height);
  expect(mark!.width / tile!.width).toBeGreaterThan(.8);
  expect(mark!.height / tile!.height).toBeGreaterThan(.8);
});

test("uses the exact weekly series for the initial dashboard sparklines", async ({ page }) => {
  const request = page.waitForRequest((candidate) => candidate.url().includes("/yahoo/chart"));
  await page.goto("/");
  expect(new URL((await request).url()).searchParams.get("range")).toBe("5d");
});

test("loads the installed application shell while offline", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) return false;
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      if ((await cache.keys()).some((request) => request.url.endsWith(".js"))) return true;
    }
    return false;
  });
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Dashboard" })).toBeVisible();
    await expect(page.getByText("You are offline.", { exact: false })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("keeps the mobile brand and add action balanced", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const brand = await page.locator(".brand img").boundingBox();
  const add = await page.getByRole("button", { name: "Add Order" }).boundingBox();
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

  const refresh = await page.getByRole("button", { name: "Refresh Prices" }).boundingBox();
  const refreshIcon = await page.locator(".refresh-button svg").boundingBox();
  expect(refresh).not.toBeNull();
  expect(refreshIcon).not.toBeNull();
  expect(Math.abs((refresh!.x + refresh!.width / 2) - (refreshIcon!.x + refreshIcon!.width / 2))).toBeLessThan(1);
  expect(Math.abs((refresh!.y + refresh!.height / 2) - (refreshIcon!.y + refreshIcon!.height / 2))).toBeLessThan(1);

  await expect(page.getByRole("img", { name: /JEDI 7-day price trend/ })).toBeVisible();
  await expect(page.locator(".holding-sparkline svg")).toHaveAttribute("viewBox", "10 0 140 55");
  const sparkline = await page.locator(".holding-sparkline svg").boundingBox();
  expect(sparkline).not.toBeNull();
  expect(sparkline!.width).toBeGreaterThanOrEqual(140);
  expect(sparkline!.height).toBeGreaterThanOrEqual(64);
  const holdingPriceSize = await page.locator(".holding-value").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(holdingPriceSize).toBeLessThanOrEqual(25);
  await expect(page.getByRole("button", { name: "Delete JEDI holding" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "More actions for JEDI" })).toHaveCount(0);
  await expect(page.locator(".holding-card")).toContainText("25 shares at €80.00 each");
  await expect(page.locator(".holding-card footer")).not.toContainText("|");
  await expect(page.locator(".holding-card")).not.toContainText("·");
  const holdingNameStyle = await page.locator(".card-instrument small").evaluate((element) => {
    const style = getComputedStyle(element);
    return { whiteSpace: style.whiteSpace, textOverflow: style.textOverflow };
  });
  expect(holdingNameStyle.whiteSpace).toBe("normal");
  expect(holdingNameStyle.textOverflow).not.toBe("ellipsis");
  await expect(page.locator("main > .holdings-section + .portfolio-insights")).toHaveCount(1);
  const insightsIconColour = await page.locator(".portfolio-insights > summary > span > svg").evaluate((element) => getComputedStyle(element).color);
  expect(insightsIconColour).toBe("rgb(40, 111, 99)");

  await page.getByRole("button", { name: "Open JEDI details" }).click();
  await expect(page.getByText("View Chart Data as a Table")).toBeVisible();
  await expect(page.getByText(/Manual Price Fallback/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "1W", exact: true })).toHaveAttribute("aria-pressed", "true");

  for (const name of ["Price", "Holding Value", "1D", "1W", "1M", "3M", "1Y", "MAX"]) {
    const control = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(control).not.toBeNull();
    expect(control!.height).toBeGreaterThanOrEqual(44);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test("uses a loss theme when the portfolio daily return is negative", async ({ page }) => {
  await page.unroute("http://market.test/yahoo/chart**");
  await page.route("http://market.test/yahoo/chart**", async (route) => {
    const timestamps = [Date.parse("2026-07-13T10:00:00Z"), Date.parse("2026-07-13T10:10:00Z")].map((value) => value / 1_000);
    await route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { chart: { error: null, result: [{ meta: { symbol: "JEDI.DE", currency: "EUR", fullExchangeName: "XETRA", instrumentType: "ETF", chartPreviousClose: 80 }, timestamp: timestamps, indicators: { quote: [{ close: [79, 78] }] } }] } } });
  });
  await page.goto("/");
  await expect(page.locator(".summary")).toHaveClass(/loss/);
});

test("does not leave a trailing hyphen in the UMMEPSA card name", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fundPortfolio = {
    schemaVersion: 1,
    baseCurrency: "EUR",
    instruments: [{ id: "ummepsa-moneybase-eur", name: "UBS (Irl) Select Money Market Fund - EUR P Acc", ticker: "UMMEPSA", isin: "IE00BWWCR731", exchange: "Moneybase Cash Fund", micCode: "FUND", currency: "EUR", assetType: "FUND", yahooSymbol: "0P0001CD0Q.F" }],
    lots: [{ id: "fund-lot", instrumentId: "ummepsa-moneybase-eur", shares: 10, pricePerShare: 106, purchaseDate: "2026-01-02", fees: 0 }],
  };
  await page.addInitScript((portfolio) => localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify(portfolio)), fundPortfolio);
  await page.goto("/");
  const name = await page.locator(".holding-card .card-instrument small").innerText();
  expect(name).not.toMatch(/\s-\s*$/);
});

test("does not draw black chart boxes during pointer interaction", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open JEDI details" }).click();
  const chart = page.getByRole("img", { name: "Historical market price chart with 2 data points" });
  const box = await chart.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * .65, box!.y + box!.height * .5);
  await page.mouse.click(box!.x + box!.width * .65, box!.y + box!.height * .5);
  await expect(page.locator(".chart")).not.toHaveAttribute("tabindex", "0");
  await expect(page.locator(".chart .recharts-surface")).not.toHaveAttribute("tabindex", "0");
  const blackBoxStyles = await page.locator(".chart .recharts-wrapper").evaluate((wrapper) => {
    const elements = [wrapper, ...wrapper.querySelectorAll("svg, rect, path")];
    return elements.map((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return { outline: style.outline, stroke: style.stroke, fill: style.fill, border: style.border, width: rect.width, height: rect.height };
    }).filter((item) => (item.outline.includes("rgb(0, 0, 0)") || item.stroke === "rgb(0, 0, 0)" || item.fill === "rgb(0, 0, 0)" || item.border.includes("rgb(0, 0, 0)")) && item.width > 200 && item.height > 100);
  });
  expect(blackBoxStyles).toEqual([]);

  await page.getByRole("button", { name: "Close details" }).click();
  await page.locator(".portfolio-insights > summary").click();
  await expect(page.locator(".portfolio-history")).toBeVisible();
  await expect(page.locator(".portfolio-history > summary")).toHaveCount(0);
  const portfolioChart = page.locator(".portfolio-history-chart");
  await portfolioChart.scrollIntoViewIfNeeded();
  const portfolioBox = await portfolioChart.boundingBox();
  expect(portfolioBox).not.toBeNull();
  await page.mouse.click(portfolioBox!.x + portfolioBox!.width * .65, portfolioBox!.y + portfolioBox!.height * .5);
  await expect(portfolioChart).not.toHaveAttribute("tabindex", "0");
  await expect(portfolioChart.locator(".recharts-surface")).not.toHaveAttribute("tabindex", "0");
  await expect(page.locator(".portfolio-history-summary .summary-separator")).toHaveCount(1);
  await expect(page.locator(".portfolio-history-summary .change-separator")).toHaveCount(0);
});

test("prefetches enough history for combined weekly and monthly performance", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("1 of 1 EUR positions valued")).toBeVisible();
  const threeMonthResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("range") === "3mo");
  await page.getByRole("button", { name: "Open JEDI details" }).click();
  await threeMonthResponse;
  await expect(page.locator(".period-performance")).toContainText("+6.67%");
  await expect(page.locator(".period-performance")).toContainText("+14.29%");
});

test("keeps insufficient performance status intact on desktop", async ({ page }) => {
  await page.unroute("http://market.test/yahoo/chart**");
  await page.route("http://market.test/yahoo/chart**", async (route) => {
    const range = new URL(route.request().url()).searchParams.get("range");
    const timestamps = (range === "3mo"
      ? ["2026-07-06T09:00:00Z", "2026-07-13T09:00:00Z"]
      : ["2026-07-13T10:00:00Z", "2026-07-13T10:10:00Z"])
      .map((value) => Date.parse(value) / 1_000);
    await route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { chart: { error: null, result: [{ meta: { symbol: "JEDI.DE", currency: "EUR", fullExchangeName: "XETRA", instrumentType: "ETF", chartPreviousClose: 79 }, timestamp: timestamps, indicators: { quote: [{ close: range === "3mo" ? [75, 80] : [78, 80] }] } }] } } });
  });
  await page.setViewportSize({ width: 1180, height: 850 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open JEDI details" }).click();
  const unavailable = page.locator(".period-performance dd", { hasText: "N/A" });
  await expect(unavailable).toHaveCount(1);
  expect(await unavailable.first().evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");
});

test("opens portfolio history and shows compact chart summaries", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".holding-card .return-chip")).toContainText(/\([+-]\d/);
  await expect(page.locator(".holding-card .return-chip .change-separator")).toHaveCount(0);
  expect(await page.locator(".holding-sparkline").evaluate((element) => getComputedStyle(element).borderLeftStyle)).toBe("solid");

  await page.getByRole("button", { name: "Open JEDI details" }).click();
  await expect(page.locator(".chart-period-stats")).toContainText("Low");
  await expect(page.locator(".chart-period-stats")).toContainText("High");
  await page.getByRole("button", { name: "Close details" }).click();

  await page.locator(".portfolio-insights > summary").click();
  await expect(page.locator(".portfolio-history")).toHaveJSProperty("tagName", "SECTION");
  await expect(page.locator(".portfolio-history > summary")).toHaveCount(0);
  await expect(page.locator(".portfolio-history-summary")).toContainText(/Change .* \([+-]\d/);
});

test("aligns mobile recovery button icons and labels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const actions = await page.locator(".settings-data-actions .button").all();
  const alignments = await Promise.all(actions.map((action) => action.evaluate((element) => {
    const style = getComputedStyle(element);
    return { display: style.display, columns: style.gridTemplateColumns, alignment: style.alignItems, justification: style.justifyContent };
  })));
  for (const alignment of alignments) {
    expect(alignment.display).toBe("grid");
    expect(alignment.columns.split(" ")).toHaveLength(2);
    expect(alignment.alignment).toBe("center");
    expect(alignment.justification).toBe("center");
  }
});

test("does not overflow on the narrowest supported phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await expect(page.getByRole("button", { name: "Add Order" })).toBeVisible();

  await page.getByRole("button", { name: "Add Order" }).click();
  await page.getByRole("radio", { name: /JEDI/ }).evaluate((radio) => (radio as HTMLInputElement).click());
  await expect(page.getByLabel("Purchase Date")).toBeVisible();
  const purchaseDate = await page.getByLabel("Purchase Date").boundingBox();
  const purchaseForm = await page.locator(".purchase-modal form").boundingBox();
  expect(purchaseDate).not.toBeNull();
  expect(purchaseForm).not.toBeNull();
  expect(purchaseDate!.x).toBeGreaterThanOrEqual(purchaseForm!.x);
  expect(purchaseDate!.x + purchaseDate!.width).toBeLessThanOrEqual(purchaseForm!.x + purchaseForm!.width + .5);
  const dateStyle = await page.getByLabel("Purchase Date").evaluate((element) => {
    const style = getComputedStyle(element);
    return { paddingLeft: style.paddingLeft, paddingRight: style.paddingRight, minWidth: style.minWidth, maxWidth: style.maxWidth };
  });
  expect(Number.parseFloat(dateStyle.paddingLeft)).toBeGreaterThanOrEqual(10);
  expect(Number.parseFloat(dateStyle.paddingRight)).toBeGreaterThanOrEqual(10);
  expect(dateStyle.minWidth).toBe("0px");
  expect(dateStyle.maxWidth).toBe("100%");
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

test("keeps the purchase date aligned on tablet", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await page.getByRole("button", { name: "Add Order" }).click();
  await page.getByRole("radio", { name: /JEDI/ }).evaluate((radio) => (radio as HTMLInputElement).click());
  await expect(page.getByLabel("Purchase Date")).toBeVisible();

  const purchaseDate = await page.getByLabel("Purchase Date").boundingBox();
  const brokerFees = await page.getByLabel(/Broker Fees/).boundingBox();
  expect(purchaseDate).not.toBeNull();
  expect(brokerFees).not.toBeNull();
  expect(Math.abs(purchaseDate!.width - brokerFees!.width)).toBeLessThan(1);
  expect(Math.abs(purchaseDate!.height - brokerFees!.height)).toBeLessThan(1);
  expect(purchaseDate!.height).toBeLessThanOrEqual(52);
});

test("moves the delete action from the holding card to detail bottom", async ({ page }) => {
  await page.unroute("http://market.test/yahoo/chart**");
  await page.route("http://market.test/yahoo/chart**", async (route) => {
    const now = Math.floor(Date.now() / 1_000);
    await route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { chart: { error: null, result: [{ meta: { symbol: "JEDI.DE", currency: "EUR", fullExchangeName: "XETRA", instrumentType: "ETF", chartPreviousClose: 79 }, timestamp: [now - 600, now], indicators: { quote: [{ close: [79, 80] }] } }] } } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Delete JEDI holding" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open JEDI details" }).click();
  const remove = page.getByRole("button", { name: "Delete JEDI holding" });
  await expect(remove).toBeVisible();
  await expect(remove.locator("svg")).toHaveCount(1);
});

test("uses consistent full-screen mobile modals without focusing shares", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const expectFullScreen = async (dialog: ReturnType<typeof page.getByRole>) => {
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
    expect(box!.width).toBeCloseTo(390, 0);
    expect(box!.height).toBeCloseTo(844, 0);
    expect(await dialog.evaluate((element) => getComputedStyle(element).borderRadius)).toBe("0px");
  };

  await page.getByRole("button", { name: "Add Order" }).click();
  const purchase = page.getByRole("dialog", { name: "Add Order" });
  await expectFullScreen(purchase);
  await page.getByRole("radio", { name: /JEDI/ }).click();
  await expect(page.getByLabel("Shares")).not.toBeFocused();
  await page.getByRole("button", { name: "Close order form" }).click();

  await page.getByRole("button", { name: "Settings" }).click();
  await expectFullScreen(page.getByRole("dialog", { name: "Settings" }));
  await expect(page.getByText("Private - Local to This Browser")).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();

  await page.getByRole("button", { name: "Open JEDI details" }).click();
  await expectFullScreen(page.getByRole("dialog", { name: /JEDI/ }));
});

test("shows contribution-adjusted risk statistics in portfolio insights", async ({ page }) => {
  await page.goto("/");
  const fullHistory = page.waitForResponse((response) => new URL(response.url()).searchParams.get("range") === "max");
  await page.locator(".portfolio-insights > summary").click();
  await fullHistory;
  const risk = page.getByRole("region", { name: "Risk Statistics" });
  await expect(risk).toBeVisible();
  for (const label of ["Maximum Drawdown", "Current Drawdown", "Highest Portfolio Value", "Annualised Volatility", "Best and Worst Month", "Recovery Time"]) {
    await expect(risk.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(risk).toContainText("2 recovered drawdowns");
});

test("orders the overview cards by value, invested, return and today", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".metric-card .metric-label p")).toHaveText(["Current Value", "Invested", "Market Return", "Today"]);
});

test("removes the portfolio-history cash-flow disclaimer", async ({ page }) => {
  await page.goto("/");
  await page.locator(".portfolio-insights > summary").click();
  await expect(page.getByText(/Value includes purchases and deposits/i)).toHaveCount(0);
});

test("collapses long order histories and lets the user expand them", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const manyOrders = {
    ...sample,
    lots: Array.from({ length: 10 }, (_, index) => ({ id: `lot-${index + 1}`, instrumentId: "jedi-xetra-eur", shares: 1, pricePerShare: 70 + index, purchaseDate: `2026-01-${String(index + 1).padStart(2, "0")}`, fees: 0 })),
  };
  await page.addInitScript((portfolio) => localStorage.setItem("etf-tracker.portfolio.v1", JSON.stringify(portfolio)), manyOrders);
  await page.goto("/");
  await page.getByRole("button", { name: "Open JEDI details" }).click();
  await expect(page.locator(".order-card")).toHaveCount(3);
  expect(await page.locator(".order-card time").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime")))).toEqual(["2026-01-10", "2026-01-09", "2026-01-08"]);
  const showAll = page.getByRole("button", { name: "Show All 10 Orders" });
  await expect(showAll).toHaveAttribute("aria-expanded", "false");
  await showAll.click();
  await expect(page.locator(".order-card")).toHaveCount(10);
  const showFewer = page.getByRole("button", { name: "Show Fewer Orders" });
  await expect(showFewer).toHaveAttribute("aria-expanded", "true");
  await showFewer.click();
  await expect(page.locator(".order-card")).toHaveCount(3);
});

test("locks and restores dashboard scrolling while a modal is open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Add Order" }).evaluate((button) => (button as HTMLButtonElement).click());
  const locked = await page.locator("body").evaluate((body) => {
    const style = getComputedStyle(body);
    return { position: style.position, overflow: style.overflow, top: style.top };
  });
  expect(locked.position).toBe("fixed");
  expect(locked.overflow).toBe("hidden");
  await expect.poll(() => page.locator(".purchase-modal").evaluate((modal) => modal.scrollTop)).toBe(0);
  const lockedScrollPosition = -Number.parseFloat(locked.top);
  expect(lockedScrollPosition).toBeGreaterThan(0);

  await page.mouse.wheel(0, 600);
  await expect.poll(async () => -Number.parseFloat(await page.locator("body").evaluate((body) => getComputedStyle(body).top))).toBeCloseTo(lockedScrollPosition, 0);

  await page.getByRole("button", { name: "Close order form" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(lockedScrollPosition, 0);
});

test("uses one close-button treatment across modal types", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const styleOf = (name: string) => page.getByRole("button", { name }).evaluate((button) => {
    const style = getComputedStyle(button);
    return { width: style.width, height: style.height, radius: style.borderRadius, border: style.borderStyle };
  });

  await page.getByRole("button", { name: "Add Order" }).click();
  const purchase = await styleOf("Close order form");
  await page.getByRole("button", { name: "Close order form" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = await styleOf("Close settings");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("button", { name: "Open JEDI details" }).click();
  const details = await styleOf("Close details");

  expect(settings).toEqual(purchase);
  expect(details).toEqual(purchase);
  expect(Number.parseFloat(details.width)).toBeGreaterThanOrEqual(44);
});

test("shows matching privacy and market-data footer icons", async ({ page }) => {
  await page.goto("/");
  const footerItems = page.locator(".site-footer p");
  await expect(footerItems).toHaveCount(2);
  await expect(footerItems.nth(0).locator("svg")).toHaveCount(1);
  await expect(footerItems.nth(1).locator("svg")).toHaveCount(1);
});

test("shows an explicit rate-limit error without inventing a price", async ({ page }) => {
  await page.unroute("http://market.test/yahoo/chart**");
  await page.route("http://market.test/yahoo/chart**", (route) => route.fulfill({ status: 429, headers: { "access-control-allow-origin": "*" }, json: { error: "daily request allowance reached" } }));
  await page.goto("/");
  await expect(page.locator(".status.unavailable:visible").first()).toBeVisible();
  await expect(page.locator(".fallback-reason:visible").first()).toContainText("Rate limit reached");
  await expect(page.getByLabel("0 of 1 EUR positions valued")).toBeVisible();
});

test("keeps the holdings list free of unnecessary filters", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByLabel("1 holding shown")).toBeVisible();
  await expect(page.getByPlaceholder("Search holdings")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Gainers" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Losers" })).toHaveCount(0);
  await expect(page.locator(".holding-card:visible")).toHaveCount(1);
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

  await page.getByRole("button", { name: "Add Order" }).click();
  await expect(page.getByRole("dialog", { name: "Add Order" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Add Order" })).toBeHidden();
  expect(page.url()).toBe(dashboardUrl);
});

test("uses mobile order cards without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open JEDI details" }).click();

  await expect(page.getByText("1 Order", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Order actions for 2026-01-02")).toBeVisible();
  await expect(page.locator(".order-card:visible").getByText("Each", { exact: true })).toBeVisible();
  await expect(page.locator(".order-card:visible").getByText("2 Jan 2026", { exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
