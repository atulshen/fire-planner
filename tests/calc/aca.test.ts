import { describe, it, expect } from 'vitest';
import { getAcaContributionPct, calcAcaSubsidy, calcAcaSubsidyForYear, estimateBenchmarkPremium, getAcaCliff, getAcaHouseholdFpl } from '../../src/calc/aca';
import { ACA_FPL_BASELINE } from '../../src/constants/aca';

describe('getAcaContributionPct', () => {
  it('returns null below 100% FPL', () => {
    expect(getAcaContributionPct(10000)).toBeNull();
  });

  it('returns null above 400% FPL', () => {
    expect(getAcaContributionPct(ACA_FPL_BASELINE * 4 + 1)).toBeNull();
  });

  it('returns ~2.1% at 100% FPL', () => {
    expect(getAcaContributionPct(ACA_FPL_BASELINE)).toBeCloseTo(0.021, 3);
  });

  it('returns 9.96% at 300-400% FPL', () => {
    expect(getAcaContributionPct(ACA_FPL_BASELINE * 3.5)).toBeCloseTo(0.0996, 3);
  });

  it('interpolates between breakpoints', () => {
    const pct = getAcaContributionPct(ACA_FPL_BASELINE * 1.5);
    expect(pct).not.toBeNull();
    expect(pct!).toBeGreaterThan(0.021);
    expect(pct!).toBeLessThan(0.066);
  });
});

describe('calcAcaSubsidy', () => {
  it('is not eligible below 100% FPL', () => {
    const result = calcAcaSubsidy(10000, 50);
    expect(result.eligible).toBe(false);
    expect(result.medicaidEligible).toBe(true);
    expect(result.subsidy).toBe(0);
    expect(result.netPremium).toBe(0);
  });

  it('cliff: not eligible above 400% FPL', () => {
    const cliff = ACA_FPL_BASELINE * 4;
    const result = calcAcaSubsidy(cliff + 1, 50);
    expect(result.eligible).toBe(false);
    expect(result.medicaidEligible).toBe(false);
    expect(result.subsidy).toBe(0);
  });

  it('provides subsidy just below cliff', () => {
    const justBelow = ACA_FPL_BASELINE * 3.99;
    const result = calcAcaSubsidy(justBelow, 50);
    expect(result.eligible).toBe(true);
    expect(result.subsidy).toBeGreaterThan(0);
  });

  it('subsidy is higher for lower incomes', () => {
    const low = calcAcaSubsidy(ACA_FPL_BASELINE * 1.5, 50);
    const high = calcAcaSubsidy(ACA_FPL_BASELINE * 3.5, 50);
    expect(low.subsidy).toBeGreaterThan(high.subsidy);
  });

  it('net premium is gold minus subsidy', () => {
    const result = calcAcaSubsidy(ACA_FPL_BASELINE * 2.0, 50);
    expect(result.netPremium).toBeCloseTo(result.goldPremium - result.subsidy, 0);
  });

  it('premiums increase with age', () => {
    const young = calcAcaSubsidy(40000, 30);
    const old = calcAcaSubsidy(40000, 60);
    expect(old.goldPremium).toBeGreaterThan(young.goldPremium);
  });
});

describe('estimateBenchmarkPremium', () => {
  it('returns ~$625 for age 40', () => {
    const monthly = estimateBenchmarkPremium(40);
    // Should be close to $625 (the base)
    expect(monthly).toBeGreaterThan(550);
    expect(monthly).toBeLessThan(700);
  });

  it('clamps to age 64', () => {
    // Shouldn't crash for age > 64
    const premium = estimateBenchmarkPremium(70);
    expect(premium).toBeGreaterThan(0);
  });
});

describe('getAcaCliff', () => {
  it('returns 400% of FPL', () => {
    expect(getAcaCliff()).toBe(ACA_FPL_BASELINE * 4);
    expect(getAcaCliff()).toBe(64200);
  });

  it('inflates the cliff over time', () => {
    expect(getAcaCliff(10, 0.03)).toBeGreaterThan(getAcaCliff());
  });

  it('raises the cliff for larger households', () => {
    expect(getAcaHouseholdFpl(2)).toBeGreaterThan(getAcaHouseholdFpl(1));
    expect(getAcaCliff(0, 0, 2)).toBeGreaterThan(getAcaCliff());
  });
});

describe('calcAcaSubsidyForYear', () => {
  it('can keep inflation-adjusted incomes under the inflated cliff', () => {
    const currentCliff = getAcaCliff();
    const futureIncome = currentCliff * Math.pow(1.03, 10);
    const result = calcAcaSubsidyForYear(futureIncome, 50, 10, 0.03);
    expect(result.eligible).toBe(true);
  });
});
