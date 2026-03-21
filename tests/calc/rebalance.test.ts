import { describe, expect, it } from 'vitest';
import type { Holding } from '../../src/types';
import {
  deriveInvestedTargetMix,
  estimateAccountReturnFromBalances,
  estimateAccountYieldFromBalances,
  growRebalancedAccounts,
  rebalanceInvestedAccounts,
  getAccountBalance,
} from '../../src/calc/rebalance';

const makeHolding = (overrides: Partial<Holding>): Holding => ({
  ticker: 'VTI',
  name: 'Test Holding',
  account: 'taxable',
  category: 'us_stock',
  shares: 100,
  costBasis: 100,
  price: 100,
  dividendYield: 1.0,
  ...overrides,
});

describe('deriveInvestedTargetMix', () => {
  it('ignores cash and normalizes the invested mix', () => {
    const holdings = [
      makeHolding({ account: 'taxable', category: 'us_stock', shares: 60, price: 100 }),
      makeHolding({ account: 'ira', category: 'bond', shares: 40, price: 100 }),
      makeHolding({ account: 'taxable', category: 'cash', shares: 20, price: 100 }),
    ];

    const mix = deriveInvestedTargetMix(holdings);
    expect(mix.us_stock).toBeCloseTo(0.6, 6);
    expect(mix.bond).toBeCloseTo(0.4, 6);
    expect(mix.cash).toBe(0);
  });
});

describe('rebalanceInvestedAccounts', () => {
  it('prefers bonds in IRA before other accounts', () => {
    const rebalanced = rebalanceInvestedAccounts(
      { taxable: 20000, ira: 50000, roth: 30000 },
      { us_stock: 0.6, intl_stock: 0, bond: 0.4, muni: 0, reit: 0, cash: 0, crypto: 0, other: 0 },
    );

    expect(rebalanced.ira.bond).toBeCloseTo(40000, 6);
    expect(rebalanced.taxable.bond).toBeCloseTo(0, 6);
    expect(getAccountBalance(rebalanced, 'taxable')).toBeCloseTo(20000, 6);
    expect(getAccountBalance(rebalanced, 'ira')).toBeCloseTo(50000, 6);
    expect(getAccountBalance(rebalanced, 'roth')).toBeCloseTo(30000, 6);
  });

  it('spills bonds into Roth when IRA capacity is not enough', () => {
    const rebalanced = rebalanceInvestedAccounts(
      { taxable: 20000, ira: 30000, roth: 50000 },
      { us_stock: 0.2, intl_stock: 0, bond: 0.8, muni: 0, reit: 0, cash: 0, crypto: 0, other: 0 },
    );

    expect(rebalanced.ira.bond).toBeCloseTo(30000, 6);
    expect(rebalanced.roth.bond).toBeCloseTo(50000, 6);
    expect(rebalanced.taxable.us_stock).toBeCloseTo(20000, 6);
  });
});

describe('account mix estimates', () => {
  it('derives blended account return and yield from rebalanced composition', () => {
    const rebalanced = rebalanceInvestedAccounts(
      { taxable: 20000, ira: 50000, roth: 30000 },
      { us_stock: 0.6, intl_stock: 0, bond: 0.4, muni: 0, reit: 0, cash: 0, crypto: 0, other: 0 },
    );

    expect(estimateAccountReturnFromBalances(rebalanced, 'taxable')).toBeCloseTo(7.0, 6);
    expect(estimateAccountReturnFromBalances(rebalanced, 'ira')).toBeCloseTo((40000 * 3.5 + 10000 * 7.0) / 50000, 6);
    expect(estimateAccountYieldFromBalances(rebalanced, 'ira')).toBeCloseTo((40000 * 3.5 + 10000 * 1.3) / 50000, 6);
  });

  it('applies category growth inside each account', () => {
    const rebalanced = rebalanceInvestedAccounts(
      { taxable: 20000, ira: 50000, roth: 30000 },
      { us_stock: 0.6, intl_stock: 0, bond: 0.4, muni: 0, reit: 0, cash: 0, crypto: 0, other: 0 },
    );

    const grown = growRebalancedAccounts(rebalanced);
    expect(getAccountBalance(grown, 'taxable')).toBeCloseTo(20000 * 1.07, 4);
    expect(getAccountBalance(grown, 'ira')).toBeCloseTo(40000 * 1.035 + 10000 * 1.07, 4);
  });
});
