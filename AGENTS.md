# FIRE Planner

Static browser-based FIRE planning tools. No backend, no database, no server-side runtime in production.

## Current State

The TypeScript app is now the canonical implementation for both FIRE eligibility planning and post-FIRE portfolio management.

- `src/` contains the unified app, extracted calculations, rendering, state, and styles.
- `src/main.ts` is the browser entrypoint for the unified UI.
- `src/index.html` is the Vite entry HTML for the unified app.
- `dist/index.html` is the single-file production build output from Vite.
- `index.html` at the repo root is a lightweight landing page pointing to `dist/index.html`.

## Quick Start

- Install dependencies: `npm install`
- Run tests: `npm test`
- Run tests in watch mode: `npm run test:watch`
- Start the dev server for the unified app: `npm run dev`
- Build the production bundle: `npm run build`
- Production output: `dist/index.html`
- Recommended Node versions: 20, 22, or 24+

## Architecture

### Unified App

The main maintained app is the TypeScript FIRE planner in `src/`.

```
src/
  index.html               # Vite entry HTML for the unified app
  main.ts                  # Browser entrypoint, page shell, UI wiring, modal flows, imports, healthcare views
  styles.css               # Shared app styles
  types.ts                 # Shared interfaces
  constants/
    categories.ts          # Asset categories, account labels, default targets
    tax.ts                 # 2026 tax brackets, standard deduction, RMD table, tax location rules
    aca.ts                 # ACA constants, FPL, contribution table, age factors
    medicare.ts            # Medicare premiums, OOP assumptions, IRMAA brackets
    tickers.ts             # Ticker classification sets, composite fund splits
    presets.ts             # CSV import brokerage presets
    yields.ts              # Fallback yield estimates
  calc/
    tax.ts                 # Progressive tax calculation helpers
    aca.ts                 # ACA subsidy calculations
    medicare.ts            # Medicare annual cost calculations
    drawdown.ts            # Retirement drawdown simulation
    fire.ts                # FIRE eligibility math and projection model
    category.ts            # Ticker/name to category/account heuristics
    allocation.ts          # Composite fund splitting and portfolio allocation
    tax-efficiency.ts      # Tax location scoring and move suggestions
  state/
    store.ts               # Holdings/targets/cache state and persistence
    income.ts              # Yield lookup, MAGI, investment income helpers
  render/
    planner.ts             # FIRE eligibility page rendering and charting
    summary.ts             # Portfolio summary cards
    holdings.ts            # Holdings table
    allocation.ts          # Allocation donut and legend
    suggestions.ts         # Trade suggestion rendering
    account-breakdown.ts   # Account mix summary
    investment-income.ts   # Income by account and MAGI impact
    tax-efficiency.ts      # Tax efficiency UI
tests/
  calc/                    # Unit tests for calc modules
  utils/                   # Unit tests for CSV/format helpers
```

### Repo Root

- `index.html`: redirect page to the built app

## Build And Test

### Development

- `npm run dev`
  - Starts Vite using `src/` as the app root.
  - Best option while changing the unified TypeScript app.

### Testing

- `npm test`
  - Runs the Vitest suite once.
- `npm run test:watch`
  - Runs Vitest in watch mode.

Tests cover extracted logic modules only. They do not exercise DOM rendering end-to-end.

### Production Build

- `npm run build`
  - Produces a single-file app at `dist/index.html`.
  - Uses `vite-plugin-singlefile` to inline JS and CSS.

## Key Concepts

- Holdings are stored in localStorage under `fire_holdings`.
- Targets are stored under `fire_targets`.
- Live yield and price cache is stored under `fire_yield_cache`.
- User age is stored under `fire_user_age`.
- Earned income is stored under `fire_base_income`.
- Composite funds like `VTMFX` and target-date funds are split across categories for allocation and income analysis.
- Municipal bond income is federal tax-exempt but still counts toward ACA MAGI.
- ACA subsidy eligibility cliffs at 400% FPL for this model.
- Tax calculations assume a single filer.

## Common Tasks

### Add a New Asset Category

1. Update `src/constants/categories.ts`
2. Update `src/constants/yields.ts` if the category needs a default yield
3. Update `src/constants/tax.ts` if the category needs specific tax-location guidance
4. Update `src/calc/category.ts` to detect the category
5. Update `DEFAULT_TARGETS` in `src/constants/categories.ts`
6. Add or update tests where detection or allocation behavior changes

### Add a New Composite Fund

Add it to `COMPOSITE_FUNDS` in `src/constants/tickers.ts`. Allocation weights must sum to `1.0`.

### Update Tax Brackets

Edit:

- `src/constants/tax.ts`
- `src/calc/tax.ts` tests if expectations change

### Update ACA Assumptions

Edit:

- `src/constants/aca.ts`
- `src/calc/aca.ts` tests if expected outputs change

### Update Medicare Assumptions

Edit:

- `src/constants/medicare.ts`
- `src/calc/medicare.ts` if calculation behavior changes

## Conventions

- Use raw numbers for money throughout calculations. Format only at render time.
- Keep browser logic in TypeScript under `src/`, not in ad hoc inline scripts.
- Prefer extending extracted modules over duplicating logic in `main.ts`.
- Keep localStorage keys prefixed with `fire_`.
- When adding pure logic, add tests under `tests/`.

## CSV Import Notes

The app supports holdings imports from:

- Vanguard
- Fidelity
- Schwab
- E*TRADE
- Generic CSV exports

It also supports a separate Vanguard cost basis import from the Unrealized cost basis export, aggregating tax lots into a weighted-average per-share cost basis.
