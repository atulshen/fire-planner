import type { Holding, CategoryKey, YieldCache } from '../types';
import { holdings, yieldCache } from './store';
import { getCompositeSplit } from '../calc/allocation';
import { $ } from '../utils/dom';
import { DIVIDEND_YIELDS, CATEGORY_YIELDS } from '../constants/yields';

/**
 * Look up a known dividend yield for the given ticker.
 * Prefers live-cached data (if less than 7 days old), then falls back
 * to the hard-coded DIVIDEND_YIELDS map.
 */
export function lookupYield(ticker: string): number | null {
  const t = ticker.toUpperCase();
  // Prefer live cache (if < 7 days old)
  const cached = yieldCache[t];
  if (cached && cached.yield != null && (Date.now() - cached.fetched) < 7 * 86400000) {
    return cached.yield;
  }
  return DIVIDEND_YIELDS[t] ?? null;
}

/**
 * Estimate a yield for an asset category when no ticker-specific data exists.
 */
export function estimateYieldByCategory(category: string): number {
  return CATEGORY_YIELDS[category] || 1.0;
}

/**
 * Get the effective dividend yield for a holding.
 * Priority: explicit dividendYield on the holding > lookupYield > category estimate.
 */
export function getHoldingYield(h: Holding): number {
  if (h.dividendYield != null && h.dividendYield > 0) return h.dividendYield;
  const known = lookupYield(h.ticker);
  if (known !== null) return known;
  return estimateYieldByCategory(h.category);
}

/**
 * Compute annual investment income from taxable holdings that counts toward MAGI.
 * Returns taxable dividends, muni income, and their total.
 */
export function getInvestmentIncome(): {
  taxableDividends: number;
  muniIncome: number;
  total: number;
} {
  let taxableDividends = 0;
  let muniIncome = 0;

  for (const h of holdings) {
    if (h.account !== 'taxable') continue;
    const val = h.shares * h.price;
    const yld = getHoldingYield(h);
    const income = val * (yld / 100);
    const split = getCompositeSplit(h, yieldCache);

    if (split) {
      const muniPct = split.muni || 0;
      taxableDividends += income * (1 - muniPct);
      muniIncome += income * muniPct;
    } else if (h.category === 'muni') {
      muniIncome += income;
    } else {
      taxableDividends += income;
    }
  }

  return { taxableDividends, muniIncome, total: taxableDividends + muniIncome };
}

/**
 * Get the user's earned (non-investment) income from the global input field.
 */
export function getEarnedIncome(): number {
  return parseFloat($('globalBaseIncome').value) || 0;
}

/**
 * Compute Modified Adjusted Gross Income:
 * earned income + taxable investment income (including muni for ACA purposes).
 */
export function getMagi(): number {
  return getEarnedIncome() + getInvestmentIncome().total;
}
