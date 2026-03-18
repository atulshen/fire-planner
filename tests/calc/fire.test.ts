import { describe, expect, it } from 'vitest';
import { calculateFirePlan } from '../../src/calc/fire';

describe('calculateFirePlan', () => {
  it('computes a FIRE number from retirement expenses and withdrawal rate', () => {
    const result = calculateFirePlan({
      currentAge: 30,
      annualIncome: 100000,
      annualExpenses: 40000,
      currentSavings: 50000,
      returnRate: 7,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 25,
      retireExpenses: 35000,
    });

    expect(result.fireNumber).toBe(875000);
  });

  it('reaches FIRE earlier with higher savings and starting balance', () => {
    const modest = calculateFirePlan({
      currentAge: 30,
      annualIncome: 90000,
      annualExpenses: 50000,
      currentSavings: 20000,
      returnRate: 7,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 25,
      retireExpenses: 40000,
    });

    const stronger = calculateFirePlan({
      currentAge: 30,
      annualIncome: 150000,
      annualExpenses: 50000,
      currentSavings: 150000,
      returnRate: 7,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 25,
      retireExpenses: 40000,
    });

    expect(stronger.fireAge).not.toBeNull();
    expect(modest.fireAge === null || stronger.fireAge! < modest.fireAge).toBe(true);
  });

  it('marks weak plans as needing work', () => {
    const result = calculateFirePlan({
      currentAge: 35,
      annualIncome: 70000,
      annualExpenses: 65000,
      currentSavings: 10000,
      returnRate: 5,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 60000,
    });

    expect(result.status).toBe('needs_work');
    expect(result.fireAge === null || result.fireAge > 50).toBe(true);
  });

  it('inflates the retirement target when estimating retirement age', () => {
    const result = calculateFirePlan({
      currentAge: 30,
      annualIncome: 140000,
      annualExpenses: 40000,
      currentSavings: 150000,
      returnRate: 7,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 40000,
    });

    expect(result.retirementFireNumber).toBeGreaterThan(result.fireNumber);
  });

  it('increases pre-retirement spending need by inflation each year', () => {
    const result = calculateFirePlan({
      currentAge: 30,
      annualIncome: 100000,
      annualExpenses: 50000,
      currentSavings: 0,
      returnRate: 0,
      inflationRate: 10,
      withdrawalRate: 4,
      taxRate: 0,
      retireExpenses: 10000000,
    });

    expect(result.netWorths[0]).toBe(0);
    expect(result.netWorths[1]).toBe(50000);
    expect(result.netWorths[2]).toBe(95000);
    expect(result.netWorths[3]).toBe(134500);
  });
});
