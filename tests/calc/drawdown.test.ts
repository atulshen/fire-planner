import { describe, it, expect } from 'vitest';
import { simulateDrawdown } from '../../src/calc/drawdown';

describe('simulateDrawdown', () => {
  it('reinvests excess after-tax RMD cash into taxable when spending need is lower', () => {
    const result = simulateDrawdown({
      currentAge: 73,
      retireAge: 73,
      expenses: 5000,
      inflation: 0,
      returnRate: 0,
      taxRate: 0.2,
      ltcgRate: 0.15,
      ssAnnual: 0,
      iraBalance: 265000,
      rothBalance: 0,
      taxableBalance: 1000,
      taxableCostBasis: 1000,
    });

    const firstYear = result.years[0];
    expect(firstYear.rmdAmount).toBeCloseTo(10000, 6);
    expect(firstYear.fromIra).toBeCloseTo(10000, 6);
    expect(firstYear.taxesPaid).toBeCloseTo(2000, 6);
    expect(firstYear.balTaxable).toBeCloseTo(4000, 6);
    expect(firstYear.balIra).toBeCloseTo(255000, 6);
    expect(firstYear.shortfall).toBe(0);
  });
});
