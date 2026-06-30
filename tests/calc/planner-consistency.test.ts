import { describe, expect, it } from 'vitest';
import { evaluatePlannerConsistency } from '../../src/calc/planner-consistency';
import type { PlannerPortfolioContext } from '../../src/calc/portfolio-balance';

const basePortfolio: PlannerPortfolioContext = {
  totalNetWorth: 1000000,
  taxableInvested: 250000,
  taxableCash: 25000,
  ira: 500000,
  rothHsa: 225000,
  investedAssets: 975000,
  cashLikeAssets: 25000,
};

describe('evaluatePlannerConsistency', () => {
  it('returns validated when planner and drawdown both support the selected age', () => {
    const result = evaluatePlannerConsistency({
      plannerFireAge: 55,
      selectedRetirementAge: 56,
      plannerRetireExpenses: 60000,
      plannerLongevityAge: 95,
      drawdownSpending: 60000,
      drawdownLifeExp: 95,
      drawdownDepletionAge: null,
      drawdownFinalBalance: 350000,
      otherAssetsAdjustment: 0,
      liabilitiesAdjustment: 0,
      portfolioContext: basePortfolio,
    });

    expect(result.status).toBe('validated');
    expect(result.title).toContain('validates');
  });

  it('returns warning when planner says ready but drawdown depletes early', () => {
    const result = evaluatePlannerConsistency({
      plannerFireAge: 55,
      selectedRetirementAge: 56,
      plannerRetireExpenses: 60000,
      plannerLongevityAge: 95,
      drawdownSpending: 75000,
      drawdownLifeExp: 97,
      drawdownDepletionAge: 88,
      drawdownFinalBalance: 0,
      otherAssetsAdjustment: 100000,
      liabilitiesAdjustment: 0,
      portfolioContext: basePortfolio,
    });

    expect(result.status).toBe('warning');
    expect(result.drivers.some((driver) => driver.includes('manual adjustments'))).toBe(true);
    expect(result.drivers.some((driver) => driver.includes('higher annual spending'))).toBe(true);
  });

  it('returns caution when drawdown survives but planner does not yet mark the age as funded', () => {
    const result = evaluatePlannerConsistency({
      plannerFireAge: 60,
      selectedRetirementAge: 56,
      plannerRetireExpenses: 60000,
      plannerLongevityAge: 95,
      drawdownSpending: 60000,
      drawdownLifeExp: 95,
      drawdownDepletionAge: null,
      drawdownFinalBalance: 100000,
      otherAssetsAdjustment: 0,
      liabilitiesAdjustment: 0,
      portfolioContext: basePortfolio,
    });

    expect(result.status).toBe('caution');
    expect(result.summary).toContain('retirement-ready until age 60');
  });
});
