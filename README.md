# Personal EUR Portfolio Tracker

A private, local-first React dashboard for EUR-traded UCITS ETFs and one daily-NAV money-market fund. It builds as static files for GitHub Pages. Purchase lots, settings, manual prices and market cache live only in the browser.

The application prioritises honest data states over apparent completeness: missing prices remain unavailable, stale data is labelled, and combined totals report their coverage.

## Architecture

- **React + TypeScript + Vite**: static dashboard deployed to GitHub Pages.
- **Browser localStorage**: separate versioned records for portfolio, settings, EODHD key, manual prices and market cache.
- **Cloudflare Worker**: a stateless, narrow CORS adapter. It accepts only validated market symbols and never receives shares, purchase prices, dates or fees.
- **Yahoo Finance chart feed**: free, undocumented, best-effort current-session and historical data.
- **EODHD**: optional end-of-day fallback. Its API key is stored only in browser localStorage and sent to the configured Worker when a fallback is required.
- **Manual price or NAV**: final fallback, always visibly labelled.

No analytics, cookies, accounts, external databases or portfolio server are used.

## Supported instrument identities

Positions are identified by ISIN, venue and trading currency—not ticker alone.

| Holding | Type | Venue | Trading currency | Yahoo symbol |
|---|---|---|---|---|
| ANAU · IE000QDFFK00 | ETF | Milan | EUR | `ANAU-ETFP.MI` |
| UMMEPSA · IE00BWWCR731 | Money-market fund, P Acc | Daily NAV | EUR | `0P0001CD0Q.F` |
| SPYY · IE00B44Z5B48 | ETF | Xetra | EUR | `SPYY.DE` |
| VVSM · IE00BMC38736 | ETF | Xetra | EUR | `VVSM.DE` |
| JEDI · IE000YU9K6K2 | ETF | Xetra | EUR | `JEDI.DE` |
| VWCE · IE00BK5BQT80 | ETF | Xetra | EUR | `VWCE.DE` |
| QUTM · IE0007Y8Y157 | ETF | Xetra | EUR | `QUTM.DE` |
| VUAA · IE00BFMXXD54 | ETF | Xetra | EUR | `VUAA.DE` |

UMMEPSA is deliberately treated as a fund with daily NAV, not an intraday ETF. For all instruments, EUR is the **trading currency** of this configured venue; it need not be the fund's base currency.

## Do fees need to be tracked?

No. Fees default to €0. Enter broker commission or transaction charges only if you want the profit/loss cost basis to match your broker exactly. Do not enter TER or ongoing fund charges: those are already reflected in the ETF price or fund NAV.

Calculations are:

```text
totalCost = Σ(shares × purchasePrice + fees)
averagePurchasePrice = Σ(shares × purchasePrice) ÷ totalShares
currentValue = totalShares × latestPrice
profitLoss = currentValue − totalCost
profitLossPercentage = profitLoss ÷ totalCost × 100
```

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

The Worker does not log request headers or API keys in application code. Avoid enabling request-body/header logging products for this Worker.

## Market-data behaviour and limitations

The display label is **Latest available — best effort**. Free official real-time European exchange data is generally unavailable because of exchange licensing.

- Yahoo's chart endpoint is undocumented and unsupported. It may be delayed, rate-limited, changed or unavailable without notice. The parser requires exact provider symbol, trading currency, venue and instrument type, and uses the latest non-null timestamped chart point.
- Public Yahoo responses are cached briefly at the Worker and the last successful response is cached locally in the browser.
- UMMEPSA has daily NAV only; no intraday NAV is implied.
- EODHD is optional. Its [quick-start documentation](https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis) currently describes a free allowance of 20 calls per day and one year of end-of-day history. Limits and exchange coverage can change; check the provider before relying on it.
- EODHD values are labelled **Previous close — end-of-day fallback**.
- Manual values are visibly labelled, have an as-of date, and do not provide daily-change figures.
- Each quote shows source, provider exchange, market timestamp, fetch timestamp and stale state.

Fallback order is: Yahoo request → cached Yahoo → EODHD if configured → manual price/NAV → unavailable.

Historical ranges use 5-minute points for ETF 1D/1W, hourly points for 1M, and daily points for 3M/1Y/MAX. The daily-NAV fund always uses daily points.

## Optional EODHD configuration

Create an EODHD key with the provider, then paste it into dashboard **Settings**. The key is written to its own localStorage record, excluded from JSON exports, and never committed. Do not place it in `.env`, `wrangler.toml`, source code or GitHub Actions variables for this design.

If no EODHD identity is configured for an instrument, that fallback is skipped.

## Import, export and initial holdings

- **Add purchase** records individual lots and combines them into one position.
- **Export JSON** includes only the versioned portfolio document.
- **Import JSON** validates the entire file and shows a replacement preview before changing local data.
- Deleting a lot, deleting a holding and clearing the portfolio all require confirmation.

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

The private template contains the eight instrument identities and no purchase lots. The `outputs/` directory is ignored by Git.

## Verify provider symbols

This live check reads the private template and validates exact symbol, trading currency, venue, instrument type and latest timestamp against Yahoo:

```bash
pnpm verify:market-data outputs/private-portfolio-import-template.json
```

To verify through a deployed Worker, add its URL as the second argument:

```bash
pnpm verify:market-data outputs/private-portfolio-import-template.json https://YOUR-WORKER.workers.dev
```

Because Yahoo is best-effort, a temporary provider failure should be investigated rather than converted into a placeholder price.

## Deploy the dashboard to GitHub Pages

1. Create an empty GitHub repository and push this repository to its `main` branch. Confirm that no API key, `.env` file, `outputs/` file or real purchase lot is staged.
2. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push `main`, then open **Actions → Deploy portfolio to GitHub Pages**. The workflow runs linting, type checking and tests before building.
4. The workflow sets Vite's base path to `/<repository-name>/`, so assets work on a project Pages URL.
5. Deploy the Worker first, enter its URL in dashboard Settings, and press **Refresh prices**.
6. Import the private JSON template, or add purchase lots in the dashboard.

For a custom domain hosted at its root, set `VITE_BASE_PATH=/` in an adjusted workflow.

## Privacy, backup and recovery

Browser storage can be cleared by private-browsing mode, browser cleanup, device loss or site-origin changes. Export JSON after material changes and keep it in an encrypted personal backup. A different Pages domain or repository name is a different browser origin and will not see the old localStorage; import your backup there.

Changing or removing the EODHD key does not change portfolio data. Clearing the portfolio removes portfolio, manual-price and cache records, but retains public settings and the separately stored API key until you remove it in Settings.

## Scope and disclaimer

This is a personal tracking tool, not investment advice, tax software or broker reconciliation. Prices can be delayed or unavailable. Verify material decisions and tax figures against broker statements and official fund documents.
