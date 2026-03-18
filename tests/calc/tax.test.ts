import { describe, it, expect } from 'vitest';
import { calcFederalIncomeTax, calcLongTermCapitalGainsTax, calcProgressiveTax, getMarginalRate } from '../../src/calc/tax';
import { STANDARD_DEDUCTION } from '../../src/constants/tax';

describe('calcProgressiveTax', () => {
  it('returns zero tax for income at or below standard deduction', () => {
    expect(calcProgressiveTax(0).tax).toBe(0);
    expect(calcProgressiveTax(16100).tax).toBe(0);
  });

  it('calculates 10% bracket correctly', () => {
    // $20,000 income - $16,100 deduction = $3,900 taxable
    const result = calcProgressiveTax(20000);
    expect(result.tax).toBe(3900 * 0.10);
  });

  it('fills 10% bracket and enters 12% bracket', () => {
    // $40,000 income - $16,100 = $23,900 taxable
    // 10% on first $12,400 = $1,240
    // 12% on remaining $11,500 = $1,380
    const result = calcProgressiveTax(40000);
    expect(result.tax).toBeCloseTo(1240 + 1380, 0);
  });

  it('calculates correctly at 22% bracket', () => {
    // $80,000 income - $16,100 = $63,900 taxable
    // 10% on $12,400 = $1,240
    // 12% on $38,000 ($50,400 - $12,400) = $4,560
    // 22% on $13,500 ($63,900 - $50,400) = $2,970
    const result = calcProgressiveTax(80000);
    expect(result.tax).toBeCloseTo(1240 + 4560 + 2970, 0);
  });

  it('effective rate is tax divided by income', () => {
    const result = calcProgressiveTax(50000);
    expect(result.effectiveRate).toBeCloseTo(result.tax / 50000, 6);
  });

  it('effective rate is 0 for zero income', () => {
    expect(calcProgressiveTax(0).effectiveRate).toBe(0);
  });
});

describe('getMarginalRate', () => {
  it('returns 10% for income just above standard deduction', () => {
    expect(getMarginalRate(17000)).toBe(0.10);
  });

  it('returns 12% for income in 12% bracket', () => {
    // $16,100 + $12,400 = $28,500 is top of 10% bracket
    expect(getMarginalRate(30000)).toBe(0.12);
  });

  it('returns 22% for income in 22% bracket', () => {
    // $16,100 + $50,400 = $66,500 is top of 12% bracket
    expect(getMarginalRate(70000)).toBe(0.22);
  });
});

describe('calcLongTermCapitalGainsTax', () => {
  it('uses remaining standard deduction to shelter gains', () => {
    const result = calcLongTermCapitalGainsTax(10000, 10000);
    expect(result.tax).toBe(0);
  });

  it('keeps gains in the 0% bracket when ordinary taxable income leaves room', () => {
    const result = calcLongTermCapitalGainsTax(40000, 10000);
    expect(result.tax).toBe(0);
  });

  it('taxes only the portion above the 0% bracket at 15%', () => {
    const result = calcLongTermCapitalGainsTax(60000, 10000);
    expect(result.tax).toBeCloseTo(667.5, 0);
  });
});

describe('calcFederalIncomeTax', () => {
  it('combines ordinary income tax and long-term capital gains tax', () => {
    const result = calcFederalIncomeTax(80000, 20000);
    expect(result.ordinaryTax).toBeCloseTo(8770, 0);
    expect(result.capitalGainsTax).toBeCloseTo(3000, 0);
    expect(result.totalTax).toBeCloseTo(11770, 0);
  });
});
