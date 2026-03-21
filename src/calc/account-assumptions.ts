import type { AccountType, Holding } from '../types';
import type { YieldCache } from '../types';
import { getEffectiveAllocation } from './allocation';
import { CATEGORY_TOTAL_RETURNS } from '../constants/returns';

export function estimateHoldingsReturn(
  holdings: Holding[],
  yieldCache?: YieldCache,
): number {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.shares * holding.price, 0);
  if (totalValue <= 0) return 0;

  let weightedReturn = 0;
  for (const holding of holdings) {
    const allocation = getEffectiveAllocation(holding, yieldCache);
    for (const [category, amount] of Object.entries(allocation)) {
      weightedReturn += amount * ((CATEGORY_TOTAL_RETURNS as Record<string, number>)[category] || CATEGORY_TOTAL_RETURNS.other);
    }
  }
  return weightedReturn / totalValue;
}

export function estimateAccountReturn(
  holdings: Holding[],
  accounts: AccountType[],
  yieldCache?: YieldCache,
): number {
  const filtered = holdings.filter((holding) => accounts.includes(holding.account));
  return estimateHoldingsReturn(filtered, yieldCache);
}

export function estimateAccountYield(
  holdings: Holding[],
  accounts: AccountType[],
  getYield: (holding: Holding) => number,
): number {
  const filtered = holdings.filter((holding) => accounts.includes(holding.account));
  const totalValue = filtered.reduce((sum, holding) => sum + holding.shares * holding.price, 0);
  if (totalValue <= 0) return 0;

  const totalIncome = filtered.reduce((sum, holding) => {
    const value = holding.shares * holding.price;
    return sum + value * (getYield(holding) / 100);
  }, 0);
  return (totalIncome / totalValue) * 100;
}
