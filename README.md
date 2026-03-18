# FIRE Planner

FIRE Planner is a static, browser-based set of Financial Independence / Retire Early tools. Everything runs client-side. There is no backend, database, or server runtime required for production.

This project is an educational planning tool, not financial, tax, legal, or investment advice. Users should consult a qualified financial advisor or other licensed professional for advice specific to their situation.

The repo now builds a single unified FIRE planning app from the TypeScript source in `src/`.

## Status

The TypeScript app is the maintained implementation for both FIRE eligibility planning and post-FIRE portfolio management.

- Canonical source: `src/`
- Production build: `dist/index.html`
- Repo-root `index.html`: lightweight landing page with instructions for opening the built app

## Requirements

- Node.js 20, 22, or 24+
- npm

## Install

```bash
npm install
```

## Scripts

```bash
npm run dev
```

Starts the Vite dev server for the unified FIRE planner app.

```bash
npm test
```

Runs the Vitest test suite once.

```bash
npm run test:watch
```

Runs the test suite in watch mode.

```bash
npm run build
```

Builds the unified app into a single-file static bundle at `dist/index.html`.

## Project Layout

```text
src/
  index.html        Vite entry HTML for the unified app
  main.ts           Browser entrypoint and UI wiring
  styles.css        App styles
  constants/        Static configuration and lookup tables
  calc/             Pure calculation modules
  state/            Local app state and persistence helpers
  render/           DOM rendering modules
  utils/            Shared formatting, DOM, and CSV helpers
tests/
  calc/             Unit tests for calculation modules
  utils/            Unit tests for helper modules
index.html          Redirect page to the built app
```

## Local Development

For app development, use the TypeScript app:

1. Run `npm install`
2. Run `npm run dev`
3. Open the Vite URL in your browser

The dev server uses `src/index.html` as the entrypoint for the unified planner.

## Production Build

Run:

```bash
npm run build
```

The build outputs `dist/index.html` as a single-file app with JS and CSS inlined.

## GitHub Pages

The repo includes [`.github/workflows/pages.yml`](./.github/workflows/pages.yml), which builds the app on pushes to `main` and deploys the generated `dist/` folder to GitHub Pages. This is the recommended way to publish the app, since `dist/` is generated output and is not checked into the repo.

## Testing

Tests currently cover extracted logic modules rather than full browser flows.

Included coverage areas:

- Tax calculations
- ACA calculations
- Category detection
- Allocation/composite fund logic
- Tax-efficiency logic
- CSV parsing
- Number formatting

## Data And Persistence

The app stores data in `localStorage` with `fire_` prefixes, including:

- `fire_holdings`
- `fire_targets`
- `fire_yield_cache`
- `fire_user_age`
- `fire_base_income`

Privacy and network model:

- The app is designed to run completely in the browser.
- User portfolio and planner data stay in browser local storage and do not leave the browser during normal use.
- The main exception is optional live symbol lookup / refresh features, which send ticker lookup requests to external market-data providers.

## Notes For Contributors

- Prefer editing `src/` for both planner and asset-management changes.
- Keep pure logic in extracted modules where possible.
- Add tests when calculation behavior changes.

More detailed maintainer guidance lives in [AGENTS.md](./AGENTS.md).
