import { describe, expect, it } from 'vitest';
import { calculateFirePlan } from '../../src/calc/fire';

describe('calculateFirePlan', () => {
  it('computes a FIRE number from retirement expenses and withdrawal rate', () => {
    const result = calculateFirePlan({
      currentAge: 30,
      retireAge: 45,
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
      retireAge: 45,
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
      retireAge: 45,
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
    expect(modest.fireAge).not.toBeNull();
    expect(stronger.fireAge!).toBeLessThan(modest.fireAge!);
  });

  it('marks weak plans as needing work', () => {
    const result = calculateFirePlan({
      currentAge: 35,
      retireAge: 45,
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
});
