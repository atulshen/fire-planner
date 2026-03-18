import type { Holding, CompositeSplit, CategoryKey } from '../types';
import { COMPOSITE_FUNDS } from '../constants/tickers';
import type { YieldCache } from '../types';

/**
 * Get the composite fund split for a holding, if applicable.
 * Checks hardcoded COMPOSITE_FUNDS first, then falls back to API-cached allocation.
 */
export function getCompositeSplit(holding: Holding, yieldCache?: YieldCache): CompositeSplit | null {
  const t = holding.ticker.toUpperCase();
  if (COMPOSITE_FUNDS[t]) return COMPOSITE_FUNDS[t];
  if (yieldCache) {
    const cached = yieldCache[t];
    if (cached?.allocation) return cached.allocation;
  }
  return null;
}

/**
 * Get the effective asset allocation for a single holding.
 * Composite funds are split across categories; single-category funds return their full value.
 */
export function getEffectiveAllocation(
  holding: Holding,
  yieldCache?: YieldCache,
): Record<string, number> {
  const val = holding.shares * holding.price;
  const split = getCompositeSplit(holding, yieldCache);
  if (split) {
    const result: Record<string, number> = {};
    for (const [cat, pct] of Object.entries(split)) {
      if (pct > 0) result[cat] = val * pct;
    }
    return result;
  }
  return { [holding.category]: val };
}

/**
 * Compute the aggregate allocation across all holdings.
 */
export function computeAllocation(
  holdings: Holding[],
  yieldCache?: YieldCache,
): Record<CategoryKey, number> {
  const byCat: Record<string, number> = {};
  for (const h of holdings) {
    const alloc = getEffectiveAllocation(h, yieldCache);
    for (const [cat, amt] of Object.entries(alloc)) {
      byCat[cat] = (byCat[cat] || 0) + amt;
    }
  }
  return byCat as Record<CategoryKey, number>;
}
