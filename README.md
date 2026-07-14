# ETF Portfolio Tracker

A private, local-first React dashboard for EUR-traded UCITS ETFs and one Moneybase cash fund. It builds as static files for GitHub Pages. Orders, settings and the market cache live only in the browser.

The application prioritises honest data states over apparent completeness: missing prices remain unavailable, stale data is labelled, and combined totals report their coverage.

## Architecture

- **React + TypeScript + Vite**: static dashboard deployed to GitHub Pages.
- **Browser localStorage**: separate versioned records for portfolio, settings and market cache.
- **Cloudflare Worker**: a stateless, narrow CORS adapter. It accepts only validated market symbols and never receives shares, purchase prices, dates or fees.
- **Yahoo Finance chart feed**: free, undocumented current-session ETF prices, historical ETF data and daily fund NAV data.
- **Moneybase cash-fund model**: published NAV values the position; a trailing 7-day annualised NAV yield is recalculated automatically for context.

No analytics, cookies, accounts, external databases or portfolio server are used.

## Supported instrument identities

Positions are identified by ISIN, venue and trading currency - not ticker alone.

| Holding | Type | Venue | Trading currency | Yahoo symbol |
|---|---|---|---|---|
| ANAU · IE000QDFFK00 | ETF | Milan | EUR | `ANAU-ETFP.MI` |
| UMMEPSA · IE00BWWCR731 | Money-market fund, P Acc | Moneybase Cash Fund | EUR | `0P0001CD0Q.F` |
| SPYY · IE00B44Z5B48 | ETF | Xetra | EUR | `SPYY.DE` |
| VVSM · IE00BMC38736 | ETF | Xetra | EUR | `VVSM.DE` |
| JEDI · IE000YU9K6K2 | ETF | Xetra | EUR | `JEDI.DE` |
| VWCE · IE00BK5BQT80 | ETF | Xetra | EUR | `VWCE.DE` |
| QUTM · IE0007Y8Y157 | ETF | Xetra | EUR | `QUTM.DE` |
| VUAA · IE00BFMXXD54 | ETF | Xetra | EUR | `VUAA.DE` |

UMMEPSA is shown as the accumulating Moneybase cash fund. The tracker values its units using the latest published daily NAV from the configured Yahoo identity. It also derives a trailing 7-day annualised yield from NAV history and updates it whenever market data refreshes. This derived figure is not Moneybase's advertised APY and is never used to value the holding. For all instruments, EUR is the **trading currency** of the configured venue; it need not be the fund's base currency.

## Do fees need to be tracked?

No. Broker fees default to €0. When entered, each fee is treated as a one-off wallet expense paid on top of that purchase. It does not reduce the number of shares and is excluded from **Invested** and **Market Return**, matching Moneybase's presentation. The dashboard tracks accumulated broker fees separately, while the detail view retains **Net Return** after fees.

Calculations are:

```text
totalCost = Σ(shares × purchasePrice + fees)
totalInvested = Σ(shares × purchasePrice)
totalFees = Σ(fees)
averagePurchasePrice = Σ(shares × purchasePrice) ÷ totalShares
currentValue = totalShares × latestPrice
marketReturn = currentValue − Σ(shares × purchasePrice)
marketReturnPercentage = marketReturn ÷ Σ(shares × purchasePrice) × 100
netReturn = currentValue − totalCost
netReturnPercentage = netReturn ÷ totalCost × 100
```

For UMMEPSA, published NAV is authoritative. If NAV is unavailable, the value and return remain unavailable. A yield percentage is never used to invent a fund balance.

Missing prices are never replaced with zero. Non-EUR positions may be imported, but are excluded from combined EUR totals and reported in coverage.

## Local development

Requirements: Node.js 22+ and pnpm 10.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`. To test the production output:

```bash
pnpm build
pnpm preview
```

Quality checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Playwright normally downloads its own Chromium build. On Windows, you can instead run the browser tests with an existing Chrome installation:

```powershell
$env:PLAYWRIGHT_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
pnpm test:e2e
```

The checked-in VanEck example is in `src/config/samplePortfolio.ts`: 25 JEDI shares at €76.80, total invested €1,920 excluding fees. It is illustrative and is not loaded automatically.

## Deploy the market-data Worker

The Worker follows Cloudflare's narrow [CORS proxy pattern](https://developers.cloudflare.com/workers/examples/cors-header-proxy/) and uses the [Workers free-plan limits](https://developers.cloudflare.com/workers/platform/limits/). It is not a general-purpose proxy: hosts, routes, methods, symbols, ranges and intervals are restricted.

1. Create a Cloudflare account and authenticate Wrangler:

   ```bash
   pnpm exec wrangler login
   ```

2. In `wrangler.toml`, change `ALLOWED_ORIGINS` to the exact Pages origin. Keep local origins only if needed. For example:

   ```toml
   ALLOWED_ORIGINS = "https://YOUR-NAME.github.io,http://localhost:5173,http://localhost:4173"
   ```

   The browser Origin contains no repository path, so use `https://YOUR-NAME.github.io`, not `/REPOSITORY`.

3. Deploy:

   ```bash
   pnpm worker:deploy
   ```

4. Copy the resulting `https://…workers.dev` URL. In the dashboard, open **Settings**, paste the Worker URL, save, then refresh prices.

The Worker does not receive portfolio holdings. Avoid enabling request-header logging products for this Worker.

## Market-data behaviour and limitations

- Yahoo's chart endpoint is undocumented and unsupported. It may be delayed, rate-limited, changed or unavailable without notice. ETF responses must match the exact provider symbol, trading currency, exchange venue and instrument type. Fund NAV responses must match the exact provider symbol, trading currency and fund type; the provider venue is shown separately because Moneybase is the descriptive holding venue rather than Yahoo's NAV host venue. The parser uses the latest non-null timestamped chart point.
- Public Yahoo responses are cached briefly at the Worker and the last successful response is cached locally in the browser.
- UMMEPSA uses daily Yahoo fund NAV data. Its displayed 7-day annualised NAV yield is calculated automatically from that history and is informational only.
- Each quote shows source, provider exchange, market timestamp, fetch timestamp and stale state.

Fallback order is: Yahoo request → cached Yahoo → unavailable.

Historical ranges use 5-minute points for ETF 1D/1W, hourly points for ETF 1M, and daily points for ETF 3M/1Y/MAX. UMMEPSA uses daily NAV points at every range because no intraday NAV exists. The default **Price** chart shows a weighted average purchase-price baseline when it falls inside the visible market range; a distant cost basis never flattens short-term price movement. Its tooltip shows only date and price. The optional **Holding Value** view compares historical holding value with invested cost, excludes broker fees and starts at the first purchase, so it never plots a misleading zero before shares were owned. Its tooltip also shows holding value and change. Charts use a padded data range rather than forcing the Y-axis to zero, so normal market movement remains readable.

On phones, holdings can be filtered to all positions, gainers or losers. Each card includes a 7-day price sparkline. Holding details and the purchase form behave like in-app pages: the browser Back gesture closes them before leaving the dashboard. Orders use compact touch-friendly cards on phones and a table on larger screens.

## Logo Assets

The application logo, favicon and simplified issuer wordmarks are bundled as SVG assets under `public/`. They do not make third-party image requests and fall back to text if an asset is unavailable. Issuer names and marks remain trademarks of their respective owners.

## Import, Export and Initial Holdings

- **Add Purchase** records individual lots and combines them into one position.
- **Export JSON** includes only the versioned portfolio document.
- **Import JSON** validates the entire file and shows a replacement preview before changing local data.
- Deleting a lot, deleting a holding and clearing the portfolio all require confirmation.

If UMMEPSA was previously recorded using an estimated cash-balance cost rather than a per-unit NAV purchase price, import the corrected portfolio JSON before using Yahoo NAV. The dashboard blocks an implausible fund return and displays **Review Cost Basis** instead of silently multiplying incompatible values.

For a public, non-personal starting configuration, edit `src/config/samplePortfolio.ts` before building. Never commit your real lots.

For the real portfolio, use the generated, gitignored `outputs/private-portfolio-import-template.json`. Add lots using this shape and import it after deployment:

```json
{
  "id": "a-unique-lot-id",
  "instrumentId": "jedi-xetra-eur",
  "shares": 25,
  "pricePerShare": 76.8,
  "purchaseDate": "2026-01-02",
  "fees": 0
}
```

The private template contains the eight instrument identities and no orders. The `outputs/` directory is ignored by Git.

## Verify provider symbols

This live check reads the private template and validates every configured Yahoo identity, including UMMEPSA's daily fund NAV symbol, trading currency, venue or fund type, and latest timestamp:

```bash
pnpm verify:market-data outputs/private-portfolio-import-template.json
```

To verify through a deployed Worker, add its URL as the second argument:

```bash
pnpm verify:market-data outputs/private-portfolio-import-template.json https://YOUR-WORKER.workers.dev
```

Because Yahoo is an undocumented source, a temporary provider failure should be investigated rather than converted into a placeholder price.

## Deploy the dashboard to GitHub Pages

1. Create an empty GitHub repository and push this repository to its `main` branch. Confirm that no API key, `.env` file, `outputs/` file or real order is staged.
2. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push `main`, then open **Actions → Deploy portfolio to GitHub Pages**. The workflow runs linting, type checking and tests before building.
4. The workflow sets Vite's base path to `/<repository-name>/`, so assets work on a project Pages URL.
5. Deploy the Worker first, enter its URL in dashboard Settings, and press **Refresh prices**.
6. Import the private JSON template, or add orders in the dashboard.

For a custom domain hosted at its root, set `VITE_BASE_PATH=/` in an adjusted workflow.

### Add to a phone home screen

After deployment, open the GitHub Pages URL in Safari or Chrome and choose **Add to Home Screen**. The included web-app manifest opens the tracker in a standalone window and retains the same browser-local portfolio data.

## Privacy, backup and recovery

Browser storage can be cleared by private-browsing mode, browser cleanup, device loss or site-origin changes. Export JSON after material changes and keep it in an encrypted personal backup. A different Pages domain or repository name is a different browser origin and will not see the old localStorage; import your backup there.

Clearing the portfolio removes portfolio and cache records, including any obsolete manual-price record left by an older version. The Worker URL remains in browser settings so the dashboard can reconnect after a portfolio import.

## Scope and disclaimer

This is a personal tracking tool, not investment advice, tax software or broker reconciliation. Prices can be delayed or unavailable. Verify material decisions and tax figures against broker statements and official fund documents.
