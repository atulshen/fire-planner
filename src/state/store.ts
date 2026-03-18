import type { Holding, CategoryKey, AccountType, YieldCache } from '../types';
import { DEFAULT_TARGETS } from '../constants/categories';
import { COMPOSITE_FUNDS } from '../constants/tickers';

// ---- State ----

export let holdings: Holding[] = JSON.parse(localStorage.getItem('fire_holdings') || '[]');

export let targets: Record<CategoryKey, number> = JSON.parse(
  localStorage.getItem('fire_targets') || 'null'
) || { ...DEFAULT_TARGETS };

export let yieldCache: YieldCache = JSON.parse(
  localStorage.getItem('fire_yield_cache') || '{}'
);

export let activeAccount: string = 'all';

export let holdingsSort: { key: string | null; asc: boolean } = {
  key: null,
  asc: true,
};

// ---- Callbacks ----

/**
 * Callback invoked after sortHoldings() updates the sort state.
 * Main.ts should set this to trigger a re-render (avoids circular imports).
 */
export let onSortChange: (() => void) | null = null;

export function setOnSortChange(cb: () => void): void {
  onSortChange = cb;
}

// ---- Mutators ----

export function setHoldings(h: Holding[]): void {
  holdings = h;
}

export function setTargets(t: Record<CategoryKey, number>): void {
  targets = t;
}

export function setYieldCache(cache: YieldCache): void {
  yieldCache = cache;
}

export function setActiveAccount(account: string): void {
  activeAccount = account;
}

// ---- Sort ----

export function sortHoldings(key: string): void {
  if (holdingsSort.key === key) {
    holdingsSort.asc = !holdingsSort.asc;
  } else {
    holdingsSort.key = key;
    holdingsSort.asc = key === 'ticker'; // alpha ascending by default, numbers descending
  }
  if (onSortChange) onSortChange();
}

// ---- Filtering ----

export function filtered(): Holding[] {
  if (activeAccount === 'all') return holdings;
  return holdings.filter((h) => h.account === activeAccount);
}

// ---- Persistence ----

function backfillYieldCacheFromHoldings(): void {
  for (const holding of holdings) {
    const ticker = holding.ticker.toUpperCase();
    const existing = yieldCache[ticker];
    yieldCache[ticker] = {
      yield: existing?.yield ?? holding.dividendYield ?? 0,
      price: existing?.price ?? holding.price ?? 0,
      name: existing?.name || holding.name || ticker,
      allocation: existing?.allocation ?? COMPOSITE_FUNDS[ticker] ?? null,
      assetClass: existing?.assetClass,
      etfCategory: existing?.etfCategory,
      detectedCategory: existing?.detectedCategory ?? holding.category,
      expenseRatio: existing?.expenseRatio,
      fetched: existing?.fetched ?? 0,
    };
  }
}

export function persist(): void {
  backfillYieldCacheFromHoldings();
  localStorage.setItem('fire_holdings', JSON.stringify(holdings));
  localStorage.setItem('fire_targets', JSON.stringify(targets));
  localStorage.setItem('fire_yield_cache', JSON.stringify(yieldCache));
}

export function persistYieldCache(): void {
  localStorage.setItem('fire_yield_cache', JSON.stringify(yieldCache));
}

// ---- Seed demo data if empty ----

export function createDemoHoldings(): Holding[] {
  return [
    // Taxable (~$346K) — concentrated equity plus balanced fund and cash
    { ticker: 'MSFT',  name: 'Microsoft Corp.',                 account: 'taxable', brokerage: 'Fidelity', accountNumber: 'Taxable-1379', category: 'us_stock',   shares: 350,  costBasis: 220, price: 390, dividendYield: 0.7 },
    { ticker: 'VTMFX', name: 'Vanguard Tax-Managed Balanced',   account: 'taxable', brokerage: 'Fidelity', accountNumber: 'Taxable-1379', category: 'other',      shares: 3500, costBasis: 35,  price: 40,  dividendYield: 1.8 },
    { ticker: 'VTI',   name: 'Vanguard Total Stock Market',     account: 'taxable', brokerage: 'Fidelity', accountNumber: 'Taxable-1379', category: 'us_stock',   shares: 120,  costBasis: 180, price: 330, dividendYield: 1.3 },
    { ticker: 'VXUS',  name: 'Vanguard Total Intl Stock',       account: 'taxable', brokerage: 'Fidelity', accountNumber: 'Taxable-1379', category: 'intl_stock', shares: 250,  costBasis: 48,  price: 60,  dividendYield: 3.1 },
    { ticker: 'VMFXX', name: 'Vanguard Federal Money Market',   account: 'taxable', brokerage: 'Fidelity', accountNumber: 'Taxable-1379', category: 'cash',       shares: 15000,costBasis: 1,   price: 1,   dividendYield: 4.0 },

    // Roth IRA (~$113K) — growth-oriented, tax-free compounding
    { ticker: 'VTI',   name: 'Vanguard Total Stock Market',     account: 'roth',    brokerage: 'Fidelity', accountNumber: 'Roth-2841',    category: 'us_stock',   shares: 180,  costBasis: 195, price: 330, dividendYield: 1.3 },
    { ticker: 'VUG',   name: 'Vanguard Growth ETF',             account: 'roth',    brokerage: 'Fidelity', accountNumber: 'Roth-2841',    category: 'us_stock',   shares: 100,  costBasis: 280, price: 360, dividendYield: 0.5 },
    { ticker: 'VXUS',  name: 'Vanguard Total Intl Stock',       account: 'roth',    brokerage: 'Fidelity', accountNumber: 'Roth-2841',    category: 'intl_stock', shares: 300,  costBasis: 50,  price: 60,  dividendYield: 3.1 },

    // Traditional IRA (~$361K) — bonds, REITs, tax-inefficient income sheltered
    { ticker: 'BND',   name: 'Vanguard Total Bond Market',      account: 'ira',     brokerage: 'Vanguard', accountNumber: 'IRA-5512',     category: 'bond',       shares: 1800, costBasis: 74,  price: 72,  dividendYield: 3.5 },
    { ticker: 'BNDX',  name: 'Vanguard Total Intl Bond',        account: 'ira',     brokerage: 'Vanguard', accountNumber: 'IRA-5512',     category: 'bond',       shares: 900,  costBasis: 50,  price: 49,  dividendYield: 3.0 },
    { ticker: 'VNQ',   name: 'Vanguard Real Estate ETF',        account: 'ira',     brokerage: 'Vanguard', accountNumber: 'IRA-5512',     category: 'reit',       shares: 500,  costBasis: 78,  price: 85,  dividendYield: 3.8 },
    { ticker: 'VCIT',  name: 'Vanguard Interm-Term Corp Bond',  account: 'ira',     brokerage: 'Vanguard', accountNumber: 'IRA-5512',     category: 'bond',       shares: 900,  costBasis: 82,  price: 80,  dividendYield: 4.2 },
    { ticker: 'TIP',   name: 'iShares TIPS Bond ETF',           account: 'ira',     brokerage: 'Vanguard', accountNumber: 'IRA-5512',     category: 'bond',       shares: 300,  costBasis: 105, price: 108, dividendYield: 2.5 },
    { ticker: 'VGSH',  name: 'Vanguard Short-Term Treasury',    account: 'ira',     brokerage: 'Vanguard', accountNumber: 'IRA-5512',     category: 'bond',       shares: 700,  costBasis: 58,  price: 58,  dividendYield: 4.0 },
  ];
}

const DEMO_EXPENSE_RATIOS: Record<string, number> = {
  MSFT: 0,
  VTMFX: 0.09,
  VTI: 0.03,
  VXUS: 0.05,
  VMFXX: 0.11,
  VUG: 0.04,
  BND: 0.03,
  BNDX: 0.07,
  VNQ: 0.13,
  VCIT: 0.03,
  TIP: 0.18,
  VGSH: 0.04,
};

export function createDemoYieldCache(): YieldCache {
  const cache: YieldCache = {};
  for (const holding of createDemoHoldings()) {
    const ticker = holding.ticker.toUpperCase();
    if (cache[ticker]) continue;
    cache[ticker] = {
      yield: holding.dividendYield ?? 0,
      price: holding.price ?? 0,
      name: holding.name || ticker,
      allocation: COMPOSITE_FUNDS[ticker] ?? null,
      detectedCategory: holding.category,
      expenseRatio: DEMO_EXPENSE_RATIOS[ticker],
      fetched: 0,
    };
  }
  return cache;
}

if (holdings.length === 0) {
  holdings = createDemoHoldings();
  yieldCache = createDemoYieldCache();
  persist();
}
