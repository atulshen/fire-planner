import { describe, it, expect } from 'vitest';
import { getCompositeSplit, getEffectiveAllocation, computeAllocation } from '../../src/calc/allocation';
import type { Holding } from '../../src/types';

const makeHolding = (overrides: Partial<Holding>): Holding => ({
  ticker: 'VTI',
  name: 'Vanguard Total Stock Market',
  account: 'taxable',
  category: 'us_stock',
  shares: 100,
  costBasis: 100,
  price: 100,
  dividendYield: 1.3,
  ...overrides,
});

describe('getCompositeSplit', () => {
  it('returns split for known composite funds', () => {
    const h = makeHolding({ ticker: 'VTMFX', category: 'other' });
    const split = getCompositeSplit(h);
    expect(split).not.toBeNull();
    expect(split!.us_stock).toBe(0.50);
    expect(split!.muni).toBe(0.50);
  });

  it('returns null for non-composite funds', () => {
    const h = makeHolding({ ticker: 'VTI' });
    expect(getCompositeSplit(h)).toBeNull();
  });

  it('returns split from yield cache if available', () => {
    const h = makeHolding({ ticker: 'UNKNOWN' });
    const cache = {
      UNKNOWN: { yield: 2, price: 50, name: 'Test', allocation: { us_stock: 0.6, bond: 0.4 }, fetched: Date.now() },
    };
    const split = getCompositeSplit(h, cache);
    expect(split).toEqual({ us_stock: 0.6, bond: 0.4 });
  });
});

describe('getEffectiveAllocation', () => {
  it('returns full value under single category for simple holdings', () => {
    const h = makeHolding({ shares: 10, price: 100, category: 'us_stock' });
    const alloc = getEffectiveAllocation(h);
    expect(alloc).toEqual({ us_stock: 1000 });
  });

  it('splits composite fund value across categories', () => {
    const h = makeHolding({ ticker: 'VTMFX', category: 'other', shares: 100, price: 100 });
    const alloc = getEffectiveAllocation(h);
    expect(alloc.us_stock).toBeCloseTo(5000, 0);
    expect(alloc.muni).toBeCloseTo(5000, 0);
  });
});

describe('computeAllocation', () => {
  it('aggregates allocation across multiple holdings', () => {
    const holdings = [
      makeHolding({ ticker: 'VTI', category: 'us_stock', shares: 10, price: 100 }),
      makeHolding({ ticker: 'BND', category: 'bond', shares: 20, price: 50 }),
    ];
    const alloc = computeAllocation(holdings);
    expect(alloc.us_stock).toBe(1000);
    expect(alloc.bond).toBe(1000);
  });

  it('handles composite funds in the mix', () => {
    const holdings = [
      makeHolding({ ticker: 'VTMFX', category: 'other', shares: 100, price: 100 }),
      makeHolding({ ticker: 'VTI', category: 'us_stock', shares: 10, price: 100 }),
    ];
    const alloc = computeAllocation(holdings);
    // VTMFX: $10K -> $5K us_stock + $5K muni; VTI: $1K us_stock
    expect(alloc.us_stock).toBeCloseTo(6000, 0);
    expect(alloc.muni).toBeCloseTo(5000, 0);
  });
});
