# Portfolio tracker review and optimisation

Reviewed against published baseline `a39f494`. Scope: speed, financial calculations, market-data reliability, offline operation, recovery and mobile usability. Synthetic holdings only were used for browser inspection and benchmarks. No private import files or credentials were modified or added to the repository.

## Measurements

- Reproducible history benchmark: eight holdings, 32,000 input prices, 96 orders, 4,000 output valuations. Latest paired run: baseline **4,777 ms**, revised **138 ms** (about **35 times faster**), with identical synthetic output. Earlier runs varied with machine load. Run `node scripts/benchmark-history.mjs --baseline a39f494`.
- Chrome DevTools mobile lab: 390 × 844, device scale 3, 4× CPU slowdown, Fast 4G, local production preview with eight synthetic holdings and mocked Yahoo responses. Final short trace: **LCP 566 ms; CLS 0.00**. This was a repeat visit with an installed service worker, not a cold GitHub Pages field measurement.
- An earlier long interaction trace recorded a 180 ms click and chart-layout work. That trace spanned an interruption; it is not a controlled responsiveness benchmark. No production field INP or CrUX claim is made.
- Published-site and local-preview runs differed in origin, cache and provider conditions. Their LCP numbers must not be treated as a controlled before/after speedup.
- Production main JavaScript: approximately 335 kB / 102 kB gzip. Recharts remains a separate, lazily evaluated chunk. Offline installation intentionally downloads lazy modules so a first detail visit can work offline.

## Implemented improvements

- Replaced repeated historical rescans with sorted cursors. Deferred closed Insights content and memoised expensive series and formatting.
- Limited chart rendering while retaining price extrema, endpoints and both sides of every invested-capital change. Transaction fidelity takes precedence if orders exceed the visual point budget.
- Added an accessible, paginated portfolio-history table. Chart animation is disabled for stable rendering.
- Deduplicated market requests, bounded browser/Worker request times, cancelled obsolete requests and guarded against late responses after clear/import/provider changes.
- Separated current-price refresh status from each historical range's loading/error state. History failures cannot overwrite current-price errors or erase another range's failure.
- Required exact instrument identity for cached prices. Legacy identity-less price caches refresh online instead of risking reuse for a different imported listing; orders remain intact.
- Corrected calendar-month boundaries, sparse-history comparisons and Yahoo multi-day previous-close interpretation. Kept fees separate from invested capital/market return and excluded non-EUR positions from combined totals.
- Documented estimated linked returns and risk statistics, including cash-flow timing and sparse-data limits. Incomplete months are not ranked as completed-month performance.
- Preserved malformed portfolio data with downloadable recovery across replacement and reload. Storage-full retries evict prices only; rejected saves never announce success or silently close order forms.
- Versioned and precached the complete offline shell. Failed installs delete incomplete caches; upgrades retain a verified previous release. HTTP errors cannot replace the working shell. Cache cleanup is scoped to this app's repository path.
- Kept long provider errors below mobile card headers and allowed return values to wrap without squeezing instrument names. Retained the compact order editor, consistent date sizing and existing mobile-first layout.

## Verification

- **131 unit/component tests passed** across 19 files. Coverage includes calculations, fees, EUR-only totals, identity collisions, calendar boundaries, sparse history, purchase-step sampling, cache races, recovery, quotas, request deadlines and failed offline upgrades.
- **71 Playwright checks passed:** desktop Chromium, mobile Chromium and targeted WebKit checks. Coverage includes narrow phones, tablet date fields, edit-order spacing/overflow, modal scrolling/focus, back navigation, chart pointer borders, rates/errors and offline first-use lazy charts.
- Lint, TypeScript, root production build and the `/ETF-Portfolio-Tracker/` production build passed. The latter contains 20 precached assets, including detail/chart chunks, with no missing files or unreplaced build markers.
- Live catalogue verification passed **8/8 Yahoo identities**, including EUR fund NAV `0P0001CD0Q.F`. Command: `node scripts/verify-market-data.mjs --catalog https://personal-eur-portfolio-market-proxy.hugelevin.workers.dev`.
- Mobile browser inspection showed eight cards and expanded Insights without horizontal overflow at 390 px; the long-error regression also checks 375 px.

## Standards

Independent review found three reliability concerns: incomplete offline caches displacing the last good release, inaccessible recovery data after replacement, and cross-range error races. Each was reproduced, fixed and regression-tested. No separate repository coding-standards document exists; README reliability/privacy requirements were used. Follow-up independent review was unavailable due the reviewer tool's usage limit; final verification was performed locally by the implementing agent.

## Spec

Independent review found four accuracy/reliability concerns: legacy cache identity collisions, inaccessible recovery, cross-range status races and sampled invested-cost timing. Each was fixed. Identity rejection, recovery after reopening, mixed-success request ordering and exact purchase-transition retention have direct regression tests.

Review summary: Standards 3 findings, highest severity high; Spec 4 findings, highest severity P1. All identified findings resolved and checked locally.

## Release and limitations

- Changes are local until pushed. Existing published baseline remains recoverable as commit `a39f494`.
- Frontend publishing uses the existing GitHub Pages workflow. Worker timeout/error improvements require a separate `pnpm worker:deploy`; no Worker deployment was performed during this review.
- First launch after this cache-identity upgrade needs connectivity to replace old cached quotes. Export portfolio JSON before publishing or clearing browser data.
- WebKit automation is not a physical iPhone/iPad test. Yahoo remains unsupported and can return delayed/incomplete data. Return/risk estimates are not broker reconciliation or exact intraday time-weighted performance.
- Browser storage can still be evicted. Keep JSON backups; no cloud holdings storage was introduced.
