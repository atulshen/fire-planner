import { describe, it, expect } from 'vitest';
import { analyzeTaxEfficiency } from '../../src/calc/tax-efficiency';
import type { Holding } from '../../src/types';

const makeHolding = (overrides: Partial<Holding>): Holding => ({
  ticker: 'TEST',
  name: 'Test Fund',
  account: 'taxable',
  category: 'us_stock',
  shares: 100,
  costBasis: 100,
  price: 100,
  dividendYield: 1.0,
  ...overrides,
});

describe('analyzeTaxEfficiency', () => {
  it('gives 100 score for optimally placed holdings', () => {
    const holdings = [
      makeHolding({ ticker: 'BND', category: 'bond', account: 'ira' }),  // bonds in IRA = ideal
      makeHolding({ ticker: 'VTI', category: 'us_stock', account: 'roth' }),  // stocks in Roth = ideal
      makeHolding({ ticker: 'VXUS', category: 'intl_stock', account: 'taxable' }),  // intl in taxable = ideal
      makeHolding({ ticker: 'MUB', category: 'muni', account: 'taxable' }),  // munis in taxable = ideal
    ];
    const result = analyzeTaxEfficiency(holdings);
    expect(result.overallScore).toBe(100);
    expect(result.moves).toHaveLength(0);
  });

  it('penalizes bonds in taxable accounts', () => {
    const holdings = [
      makeHolding({ ticker: 'BND', category: 'bond', account: 'taxable', shares: 100, price: 100 }),
    ];
    const result = analyzeTaxEfficiency(holdings);
    expect(result.overallScore).toBe(20); // worst placement
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0].to).toBe('ira');
  });

  it('gives warning for acceptable but not ideal placement', () => {
    const holdings = [
      makeHolding({ ticker: 'VTI', category: 'us_stock', account: 'taxable' }),  // acceptable, but Roth is best
    ];
    const result = analyzeTaxEfficiency(holdings);
    expect(result.overallScore).toBe(60);
    expect(result.results[0].status).toBe('warn');
  });

  it('munis in taxable score 100', () => {
    const holdings = [
      makeHolding({ ticker: 'MUB', category: 'muni', account: 'taxable' }),
    ];
    const result = analyzeTaxEfficiency(holdings);
    expect(result.overallScore).toBe(100);
  });

  it('munis in IRA score poorly (wasted tax exemption)', () => {
    const holdings = [
      makeHolding({ ticker: 'MUB', category: 'muni', account: 'ira' }),
    ];
    const result = analyzeTaxEfficiency(holdings);
    // muni ideal is ['taxable','taxable','taxable'], so IRA is not in the list
    // currentRank will be -1, which means score = 20 (worst)
    expect(result.overallScore).toBeLessThan(50);
  });

  it('weights score by value', () => {
    const holdings = [
      makeHolding({ ticker: 'BND', category: 'bond', account: 'ira', shares: 1000, price: 100 }),  // $100K ideal
      makeHolding({ ticker: 'BND2', category: 'bond', account: 'taxable', shares: 10, price: 100 }),  // $1K worst
    ];
    const result = analyzeTaxEfficiency(holdings);
    // Heavily weighted toward the ideal placement
    expect(result.overallScore).toBeGreaterThan(95);
  });

  it('skips small holdings for move suggestions', () => {
    const holdings = [
      makeHolding({ ticker: 'BND', category: 'bond', account: 'taxable', shares: 1, price: 100 }),  // $100, below $500 threshold
    ];
    const result = analyzeTaxEfficiency(holdings);
    expect(result.moves).toHaveLength(0);
  });

  it('treats HSA placement like Roth placement for scoring', () => {
    const holdings = [
      makeHolding({ ticker: 'VTI', category: 'us_stock', account: 'hsa' }),
    ];
    const result = analyzeTaxEfficiency(holdings);
    expect(result.overallScore).toBe(100);
    expect(result.results[0].status).toBe('ok');
    expect(result.moves).toHaveLength(0);
  });
});
