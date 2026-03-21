import { describe, expect, it } from 'vitest';
import type { Holding } from '../../src/types';
import { estimateAccountReturn, estimateAccountYield, estimateHoldingsReturn } from '../../src/calc/account-assumptions';

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

describe('estimateAccountReturn', () => {
  it('uses category return assumptions for simple holdings', () => {
    const holdings = [makeHolding({ account: 'ira', category: 'bond', shares: 10, price: 100 })];
    expect(estimateAccountReturn(holdings, ['ira'])).toBeCloseTo(3.5, 2);
  });

  it('weights mixed accounts by value', () => {
    const holdings = [
      makeHolding({ account: 'taxable', category: 'cash', shares: 10, price: 100 }),
      makeHolding({ account: 'taxable', category: 'us_stock', shares: 30, price: 100 }),
    ];
    expect(estimateAccountReturn(holdings, ['taxable'])).toBeCloseTo((1000 * 2.5 + 3000 * 7.0) / 4000, 2);
  });

  it('uses composite splits when available', () => {
    const holdings = [
      makeHolding({ ticker: 'VTMFX', category: 'other', shares: 100, price: 100 }),
    ];
    // VTMFX is modeled as 50% US stock, 50% muni
    expect(estimateAccountReturn(holdings, ['taxable'])).toBeCloseTo(5.0, 2);
  });
});

describe('estimateHoldingsReturn', () => {
  it('derives one invested return from the overall holdings mix regardless of account location', () => {
    const holdings = [
      makeHolding({ account: 'taxable', category: 'us_stock', shares: 30, price: 100 }),
      makeHolding({ account: 'ira', category: 'bond', shares: 10, price: 100 }),
    ];

    expect(estimateHoldingsReturn(holdings)).toBeCloseTo((3000 * 7.0 + 1000 * 3.5) / 4000, 2);
  });

  it('lets callers exclude cash when they want an invested-only return estimate', () => {
    const holdings = [
      makeHolding({ account: 'taxable', category: 'cash', shares: 10, price: 100 }),
      makeHolding({ account: 'ira', category: 'us_stock', shares: 10, price: 100 }),
    ];

    const investedOnly = holdings.filter((holding) => holding.category !== 'cash');
    expect(estimateHoldingsReturn(investedOnly)).toBeCloseTo(7.0, 2);
  });
});

describe('estimateAccountYield', () => {
  it('weights yield by account value', () => {
    const holdings = [
      makeHolding({ account: 'taxable', shares: 10, price: 100, dividendYield: 1.0 }),
      makeHolding({ account: 'taxable', shares: 10, price: 200, dividendYield: 4.0 }),
    ];
    const yieldPct = estimateAccountYield(holdings, ['taxable'], (holding) => holding.dividendYield);
    expect(yieldPct).toBeCloseTo((1000 * 0.01 + 2000 * 0.04) / 3000 * 100, 4);
  });
});
