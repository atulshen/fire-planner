import { describe, expect, it } from 'vitest';
import { calculateFirePlan } from '../../src/calc/fire';
import { calcPayrollTax, calcProgressiveTax } from '../../src/calc/tax';

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
      longevityAge: 95,
    });

    expect(result.fireNumber).toBe(875000);
  });

  it('uses the federal tax tables by default when no override is provided', () => {
    const result = calculateFirePlan({
      currentAge: 30,
      annualIncome: 100000,
      annualExpenses: 40000,
      currentSavings: 50000,
      returnRate: 7,
      inflationRate: 3,
      withdrawalRate: 4,
      retireExpenses: 35000,
      longevityAge: 95,
    });

    const incomeTax = calcProgressiveTax(100000);
    const payrollTax = calcPayrollTax(100000);
    const totalTax = incomeTax.tax + payrollTax.totalTax;
    expect(result.currentEffectiveTaxRate).toBeCloseTo((totalTax / 100000) * 100, 6);
    expect(result.annualSavings).toBeCloseTo(100000 - totalTax - 40000, 6);
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
      longevityAge: 95,
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
      longevityAge: 95,
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
      longevityAge: 95,
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
      longevityAge: 95,
    });

    expect(result.retirementFireNumber).toBeGreaterThan(result.fireNumber);
  });

  it('inflates pre-retirement income along with expenses each year', () => {
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
      longevityAge: 95,
    });

    expect(result.netWorths[0]).toBe(0);
    expect(result.netWorths[1]).toBe(50000);
    expect(result.netWorths[2]).toBe(105000);
    expect(result.netWorths[3]).toBe(165500);
  });

  it('reduces the required retirement target when Social Security is modeled', () => {
    const withoutSs = calculateFirePlan({
      currentAge: 40,
      annualIncome: 120000,
      annualExpenses: 50000,
      currentSavings: 150000,
      returnRate: 7,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 45000,
      longevityAge: 95,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 0,
    });

    const withSs = calculateFirePlan({
      currentAge: 40,
      annualIncome: 120000,
      annualExpenses: 50000,
      currentSavings: 150000,
      returnRate: 7,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 45000,
      longevityAge: 95,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 24000,
    });

    expect(withSs.retirementFireNumber).toBeLessThan(withoutSs.retirementFireNumber);
    expect(withSs.estimatedMedicalAtSocialSecurity).toBeGreaterThan(0);
    expect(withSs.netRetireExpensesAfterSocialSecurity).toBeLessThan(withSs.bridgePortfolioNeedAtRetirement);
  });

  it('can reach retirement earlier when claiming Social Security earlier', () => {
    const claimAt67 = calculateFirePlan({
      currentAge: 55,
      annualIncome: 90000,
      annualExpenses: 45000,
      currentSavings: 300000,
      returnRate: 6,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 42000,
      longevityAge: 95,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 30000,
    });

    const claimAt62 = calculateFirePlan({
      currentAge: 55,
      annualIncome: 90000,
      annualExpenses: 45000,
      currentSavings: 300000,
      returnRate: 6,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 42000,
      longevityAge: 95,
      socialSecurityClaimAge: 62,
      socialSecurityBenefit: 27000,
    });

    expect(claimAt62.fireAge).not.toBeNull();
    expect(claimAt67.fireAge).not.toBeNull();
    expect(claimAt62.fireAge!).toBeLessThanOrEqual(claimAt67.fireAge!);
  });

  it('requires more assets for a longer longevity horizon', () => {
    const shorter = calculateFirePlan({
      currentAge: 45,
      annualIncome: 130000,
      annualExpenses: 50000,
      currentSavings: 200000,
      returnRate: 6,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 45000,
      longevityAge: 85,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 24000,
    });

    const longer = calculateFirePlan({
      currentAge: 45,
      annualIncome: 130000,
      annualExpenses: 50000,
      currentSavings: 200000,
      returnRate: 6,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 45000,
      longevityAge: 100,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 24000,
    });

    expect(longer.longevityAge).toBe(100);
    expect(shorter.longevityAge).toBe(85);
    expect(longer.retirementFireNumber).toBeGreaterThan(shorter.retirementFireNumber);
  });

  it('includes age-based healthcare estimates in retirement needs', () => {
    const age60 = calculateFirePlan({
      currentAge: 60,
      annualIncome: 130000,
      annualExpenses: 50000,
      currentSavings: 5000000,
      returnRate: 6,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 45000,
      longevityAge: 95,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 24000,
    });

    const age67 = calculateFirePlan({
      currentAge: 67,
      annualIncome: 130000,
      annualExpenses: 50000,
      currentSavings: 5000000,
      returnRate: 6,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 45000,
      longevityAge: 95,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 24000,
    });

    expect(age60.estimatedMedicalAtRetirement).toBeGreaterThan(0);
    expect(age67.estimatedMedicalAtRetirement).toBeGreaterThan(0);
    expect(age60.estimatedMedicalAtRetirement).not.toBe(age67.estimatedMedicalAtRetirement);
    expect(age60.bridgePortfolioNeedToday).toBeGreaterThan(age60.retireBaseExpenses);
  });

  it('reduces pre-65 healthcare estimates when lower spending implies larger ACA subsidies', () => {
    const lowerSpending = calculateFirePlan({
      currentAge: 60,
      annualIncome: 0,
      annualExpenses: 0,
      currentSavings: 5000000,
      returnRate: 5,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 10000,
      longevityAge: 95,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 0,
    });

    const higherSpending = calculateFirePlan({
      currentAge: 60,
      annualIncome: 0,
      annualExpenses: 0,
      currentSavings: 5000000,
      returnRate: 5,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 20,
      retireExpenses: 80000,
      longevityAge: 95,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 0,
    });

    expect(lowerSpending.fireAge).toBe(60);
    expect(higherSpending.fireAge).toBe(60);
    expect(lowerSpending.estimatedMedicalAtRetirement).toBeLessThan(higherSpending.estimatedMedicalAtRetirement);
  });

  it('does not let pre-retirement projected capital go below zero', () => {
    const result = calculateFirePlan({
      currentAge: 40,
      annualIncome: 40000,
      annualExpenses: 80000,
      currentSavings: 10000,
      returnRate: 0,
      inflationRate: 3,
      withdrawalRate: 4,
      taxRate: 0,
      retireExpenses: 100000,
      longevityAge: 95,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 0,
    });

    expect(result.fireAge).toBeNull();
    expect(result.capitalAt67).toBe(0);
    expect(Math.min(...result.netWorths)).toBe(0);
  });
});
