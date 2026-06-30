import { describe, expect, it } from 'vitest';
import {
  getHoldingBalances,
  getPortfolioNetWorth,
  getPortfolioNetWorthFromBalances,
  resolvePlannerStartingNetWorth,
} from '../../src/calc/portfolio-balance';
import type { Holding } from '../../src/types';

const holdings: Holding[] = [
  { ticker: 'VMFXX', name: 'Cash', account: 'taxable', category: 'cash', shares: 1000, costBasis: 1, price: 1, dividendYield: 4 },
  { ticker: 'VTI', name: 'US Stock', account: 'taxable', category: 'us_stock', shares: 50, costBasis: 200, price: 300, dividendYield: 1.3 },
  { ticker: 'BND', name: 'Bond', account: 'ira', category: 'bond', shares: 100, costBasis: 70, price: 72, dividendYield: 3.5 },
  { ticker: 'VXUS', name: 'Intl', account: 'roth', category: 'intl_stock', shares: 80, costBasis: 50, price: 60, dividendYield: 3 },
  { ticker: 'VUSXX', name: 'Treasury MMF', account: 'hsa', category: 'cash', shares: 500, costBasis: 1, price: 1, dividendYield: 4 },
];

describe('portfolio-balance helpers', () => {
  it('splits holdings into taxable cash, taxable invested, and tax-advantaged balances', () => {
    const balances = getHoldingBalances(holdings);

    expect(balances.taxableCash).toBe(1000);
    expect(balances.taxableInvested).toBe(15000);
    expect(balances.taxable).toBe(16000);
    expect(balances.taxableBasis).toBe(11000);
    expect(balances.taxableInvestedBasis).toBe(10000);
    expect(balances.ira).toBe(7200);
    expect(balances.roth).toBe(4800);
    expect(balances.hsa).toBe(500);
  });

  it('computes total portfolio net worth from balances or holdings', () => {
    const balances = getHoldingBalances(holdings);

    expect(getPortfolioNetWorthFromBalances(balances)).toBe(28500);
    expect(getPortfolioNetWorth(holdings)).toBe(28500);
  });

  it('uses holdings for planner starting net worth when holdings exist, otherwise falls back to manual net worth', () => {
    expect(resolvePlannerStartingNetWorth(holdings, 123456)).toBe(28500);
    expect(resolvePlannerStartingNetWorth([], 123456)).toBe(123456);
  });
});
