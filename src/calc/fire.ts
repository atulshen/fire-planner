import { calcAcaSubsidyForYear, estimateBenchmarkPremium, estimateGoldPremium } from './aca';
import { calcPayrollTax, calcProgressiveTax } from './tax';
import { getMedicareAnnualCost } from './medicare';
import { PLANNING_GROWTH_RATES } from '../constants/planning';
import type { FilingStatus } from '../types';

export interface FirePlannerInputs {
  currentAge: number;
  filingStatus?: FilingStatus;
  householdSize?: number;
  spouseAge?: number;
  spouseAnnualIncome?: number;
  spouseRetirementAge?: number;
  annualIncome: number;
  annualExpenses: number;
  currentSavings: number;
  returnRate: number;
  inflationRate: number;
  withdrawalRate: number;
  taxRate?: number | null;
  retireExpenses: number;
  longevityAge?: number;
  socialSecurityClaimAge?: number;
  socialSecurityBenefit?: number;
  spouseSocialSecurityClaimAge?: number;
  spouseSocialSecurityBenefit?: number;
}

export interface FirePlannerMilestone {
  age: number;
  target: number | 'FIRE' | 'SS';
}

export interface FirePlannerResult {
  currentSavings: number;
  years: number[];
  netWorths: number[];
  fireTargets: number[];
  yearsToRetire: number | null;
  annualSavings: number;
  savingsRate: number;
  currentEffectiveTaxRate: number;
  fireNumber: number;
  retirementFireNumber: number;
  longevityAge: number;
  retireBaseExpenses: number;
  estimatedMedicalAtRetirement: number;
  estimatedMedicalAtSocialSecurity: number;
  householdSocialSecurityStartAge: number | null;
  socialSecurityClaimAge: number;
  socialSecurityAnnualBenefit: number;
  spouseSocialSecurityClaimAge: number | null;
  spouseSocialSecurityAnnualBenefit: number;
  householdSocialSecurityAnnualBenefit: number;
  bridgePortfolioNeedToday: number;
  bridgePortfolioNeedAtRetirement: number;
  netRetireExpensesAfterSocialSecurity: number;
  postSsPortfolioNeedAtClaim: number;
  fireAge: number | null;
  yearsToFire: number | null;
  projectedNetWorth: number;
  projectionAge: number;
  capitalAt67: number;
  capitalAt67Age: number;
  contributionsAtRetire: number;
  growthAtRetire: number;
  contributionsPct: number;
  growthPct: number;
  status: 'on_track' | 'close' | 'needs_work';
  milestones: FirePlannerMilestone[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const MAX_PROJECTION_AGE = 100;
const HEALTHCARE_INFLATION = PLANNING_GROWTH_RATES.healthcareCosts;

export function calculateFirePlan(inputs: FirePlannerInputs): FirePlannerResult {
  const currentAge = clamp(inputs.currentAge || 0, 18, 100);
  const filingStatus: FilingStatus = inputs.filingStatus === 'married' ? 'married' : 'single';
  const spouseAge = filingStatus === 'married'
    ? clamp(inputs.spouseAge ?? currentAge, 18, 100)
    : currentAge;
  const householdSize = Math.max(
    Math.round(inputs.householdSize ?? (filingStatus === 'married' ? 2 : 1)),
    filingStatus === 'married' ? 2 : 1,
  );
  const annualIncome = Math.max(inputs.annualIncome || 0, 0);
  const spouseAnnualIncome = filingStatus === 'married' ? Math.max(inputs.spouseAnnualIncome || 0, 0) : 0;
  const annualExpenses = Math.max(inputs.annualExpenses || 0, 0);
  const currentSavings = Math.max(inputs.currentSavings || 0, 0);
  const returnRate = Math.max(inputs.returnRate || 0, 0) / 100;
  const inflationRate = Math.max(inputs.inflationRate || 0, 0) / 100;
  const withdrawalRate = Math.max(inputs.withdrawalRate || 0, 0.01) / 100;
  const manualTaxRate =
    inputs.taxRate != null && Number.isFinite(inputs.taxRate)
      ? clamp(inputs.taxRate, 0, 100) / 100
      : null;
  const retireBaseExpenses = Math.max(inputs.retireExpenses || 0, 0);
  const longevityAge = clamp(inputs.longevityAge || 95, currentAge, MAX_PROJECTION_AGE);
  const socialSecurityClaimAge = inputs.socialSecurityClaimAge === 62 ? 62 : 67;
  const socialSecurityAnnualBenefit = Math.max(inputs.socialSecurityBenefit || 0, 0);
  const spouseRetirementAge = filingStatus === 'married'
    ? clamp(inputs.spouseRetirementAge ?? spouseAge, spouseAge, MAX_PROJECTION_AGE)
    : MAX_PROJECTION_AGE;
  const spouseSocialSecurityClaimAge = filingStatus === 'married'
    ? (inputs.spouseSocialSecurityClaimAge === 62 ? 62 : 67)
    : null;
  const spouseSocialSecurityAnnualBenefit = filingStatus === 'married'
    ? Math.max(inputs.spouseSocialSecurityBenefit || 0, 0)
    : 0;

  const inflate = (amount: number, yearOffset: number) => amount * Math.pow(1 + inflationRate, Math.max(yearOffset, 0));
  const grossIncomeForYear = (yearOffset: number) => {
    const primaryIncome = inflate(annualIncome, yearOffset);
    const spouseAgeForYear = spouseAge + yearOffset;
    const spouseIncomeForYear = filingStatus === 'married' && spouseAgeForYear < spouseRetirementAge
      ? inflate(spouseAnnualIncome, yearOffset)
      : 0;
    return primaryIncome + spouseIncomeForYear;
  };
  const effectiveTaxRateForYear = (yearOffset: number) => {
    if (manualTaxRate !== null) return manualTaxRate;
    const grossIncome = grossIncomeForYear(yearOffset);
    const incomeTax = calcProgressiveTax(grossIncome, yearOffset, inflationRate);
    const payrollTax = calcPayrollTax(grossIncome, yearOffset, inflationRate);
    return grossIncome > 0 ? (incomeTax.tax + payrollTax.totalTax) / grossIncome : 0;
  };
  const netIncomeForYear = (yearOffset: number) => {
    const grossIncome = grossIncomeForYear(yearOffset);
    if (manualTaxRate !== null) return grossIncome * (1 - manualTaxRate);
    const incomeTax = calcProgressiveTax(grossIncome, yearOffset, inflationRate);
    const payrollTax = calcPayrollTax(grossIncome, yearOffset, inflationRate);
    return grossIncome - incomeTax.tax - payrollTax.totalTax;
  };
  const netIncome = netIncomeForYear(0);
  const annualSavings = netIncome - annualExpenses;
  const savingsRate = netIncome > 0 ? (annualSavings / netIncome) * 100 : 0;
  const currentEffectiveTaxRate = effectiveTaxRateForYear(0) * 100;
  const maxYears = Math.max(longevityAge - currentAge, 0);
  const socialSecurityForYear = (yearOffset: number) => {
    const age = currentAge + yearOffset;
    const primaryBenefit = socialSecurityAnnualBenefit > 0 && age >= socialSecurityClaimAge
      ? inflate(socialSecurityAnnualBenefit, yearOffset)
      : 0;
    const spouseAgeForYear = spouseAge + yearOffset;
    const spouseBenefit = spouseSocialSecurityAnnualBenefit > 0
      && spouseSocialSecurityClaimAge !== null
      && spouseAgeForYear >= spouseSocialSecurityClaimAge
        ? inflate(spouseSocialSecurityAnnualBenefit, yearOffset)
        : 0;
    return primaryBenefit + spouseBenefit;
  };
  const medicalCostForYear = (yearOffset: number) => {
    const age = currentAge + yearOffset;
    const spouseAgeForYear = spouseAge + yearOffset;
    const pre65Adults: number[] = [];
    let medicareCost = 0;

    if (age < 65) pre65Adults.push(age);
    else medicareCost += getMedicareAnnualCost(age, 0, HEALTHCARE_INFLATION, age - 65).total;

    if (filingStatus === 'married') {
      if (spouseAgeForYear < 65) pre65Adults.push(spouseAgeForYear);
      else medicareCost += getMedicareAnnualCost(spouseAgeForYear, 0, HEALTHCARE_INFLATION, spouseAgeForYear - 65).total;
    }

    if (pre65Adults.length > 0) {
      const inflationFactor = Math.pow(1 + HEALTHCARE_INFLATION, yearOffset);
      const monthlyGold = pre65Adults.reduce((sum, adultAge) => sum + estimateGoldPremium(adultAge), 0);
      const monthlyBenchmark = pre65Adults.reduce((sum, adultAge) => sum + estimateBenchmarkPremium(adultAge), 0);
      let annualCost = (monthlyGold * 12) * inflationFactor + medicareCost;
      const ss = socialSecurityForYear(yearOffset);
      const livingSpend = inflate(retireBaseExpenses, yearOffset);
      for (let i = 0; i < 4; i++) {
        const totalSpend = livingSpend + annualCost;
        const acaIncome = Math.max(totalSpend, ss);
        const aca = calcAcaSubsidyForYear(
          acaIncome,
          pre65Adults[0],
          yearOffset,
          inflationRate,
          householdSize,
          monthlyBenchmark,
          monthlyGold,
        );
        const updatedCost = aca.netPremium * inflationFactor + medicareCost;
        if (Math.abs(updatedCost - annualCost) < 1) return updatedCost;
        annualCost = updatedCost;
      }
      return annualCost;
    }
    return medicareCost;
  };
  const totalRetirementSpendForYear = (yearOffset: number) => inflate(retireBaseExpenses, yearOffset) + medicalCostForYear(yearOffset);
  const retirementWithdrawalForYear = (yearOffset: number) => {
    return Math.max(totalRetirementSpendForYear(yearOffset) - socialSecurityForYear(yearOffset), 0);
  };
  const fireNumber = retireBaseExpenses / withdrawalRate;
  const fireTargetForYear = (yearOffset: number) => {
    const retireAge = currentAge + yearOffset;
    if (retireAge > longevityAge) return 0;

    let required = 0;
    for (let offset = maxYears; offset >= yearOffset; offset--) {
      required = (required + retirementWithdrawalForYear(offset)) / Math.max(1 + returnRate, 0.0001);
    }
    return Math.max(required, 0);
  };

  let yearsToFire: number | null = null;
  let balance = currentSavings;
  for (let y = 0; y <= maxYears; y++) {
    if (balance >= fireTargetForYear(y)) {
      yearsToFire = y;
      break;
    }
    const yearlySavings = netIncomeForYear(y) - inflate(annualExpenses, y);
    balance = balance * (1 + returnRate) + yearlySavings;
  }

  const fireAge = yearsToFire !== null ? currentAge + yearsToFire : null;
  const yearsToRetire = yearsToFire;
  const projectionYears = maxYears;

  const years: number[] = [];
  const netWorths: number[] = [];
  const fireTargets: number[] = [];
  const contributions: number[] = [];
  const growthAmounts: number[] = [];

  balance = currentSavings;
  let totalContrib = currentSavings;
  let totalGrowth = 0;

  for (let y = 0; y <= projectionYears; y++) {
    years.push(currentAge + y);
    netWorths.push(balance);
    fireTargets.push(fireTargetForYear(y));
    contributions.push(totalContrib);
    growthAmounts.push(totalGrowth);

    const growth = balance * returnRate;
    const retired = yearsToRetire !== null && y >= yearsToRetire;

    if (retired) {
      const withdrawalNeed = retirementWithdrawalForYear(y);
      balance += growth - withdrawalNeed;
    } else {
      const yearlySavings = netIncomeForYear(y) - inflate(annualExpenses, y);
      balance += growth + yearlySavings;
      totalContrib += yearlySavings;
    }

    totalGrowth += growth;

    if (balance < 0) balance = 0;
  }

  const referenceYear = yearsToRetire ?? projectionYears;
  const retirementFireNumber = fireTargets[referenceYear] ?? fireNumber;
  const projectedNetWorth = netWorths[referenceYear] ?? 0;
  const projectionAge = years[referenceYear] ?? currentAge;
  const capitalAt67Age = Math.max(67, currentAge);
  const capitalAt67Index = Math.min(Math.max(capitalAt67Age - currentAge, 0), netWorths.length - 1);
  const capitalAt67 = netWorths[capitalAt67Index] ?? currentSavings;
  const estimatedMedicalAtRetirement = medicalCostForYear(referenceYear);
  const bridgePortfolioNeedToday = retireBaseExpenses + medicalCostForYear(0);
  const bridgePortfolioNeedAtRetirement = totalRetirementSpendForYear(referenceYear);
  const socialSecurityStartOffsets = [
    socialSecurityAnnualBenefit > 0 ? Math.max(socialSecurityClaimAge - currentAge, 0) : null,
    spouseSocialSecurityAnnualBenefit > 0 && spouseSocialSecurityClaimAge !== null
      ? Math.max(spouseSocialSecurityClaimAge - spouseAge, 0)
      : null,
  ].filter((offset): offset is number => offset !== null);
  const claimYearOffset = socialSecurityStartOffsets.length > 0 ? Math.min(...socialSecurityStartOffsets) : Math.max(socialSecurityClaimAge - currentAge, 0);
  const householdSocialSecurityStartAge = socialSecurityStartOffsets.length > 0 ? currentAge + claimYearOffset : null;
  const estimatedMedicalAtSocialSecurity = medicalCostForYear(claimYearOffset);
  const netRetireExpensesAfterSocialSecurity = Math.max(totalRetirementSpendForYear(claimYearOffset) - socialSecurityForYear(claimYearOffset), 0);
  const postSsPortfolioNeedAtClaim = netRetireExpensesAfterSocialSecurity;
  const householdSocialSecurityAnnualBenefit = socialSecurityAnnualBenefit + spouseSocialSecurityAnnualBenefit;
  const contributionsAtRetire = contributions[referenceYear] ?? currentSavings;
  const growthAtRetire = growthAmounts[referenceYear] ?? 0;
  const totalAtRetire = Math.max(projectedNetWorth, 1);
  const contributionsPct = clamp((contributionsAtRetire / totalAtRetire) * 100, 0, 100);
  const growthPct = 100 - contributionsPct;

  const status: FirePlannerResult['status'] =
    yearsToFire !== null && yearsToFire <= 10
      ? 'on_track'
      : yearsToFire !== null && yearsToFire <= 20
        ? 'close'
        : 'needs_work';

  const milestones: FirePlannerMilestone[] = [];
  const targets = [100000, 250000, 500000, 1000000, 2000000];
  for (let y = 0; y < years.length; y++) {
    for (const target of targets) {
      if (netWorths[y] >= target && !milestones.find((milestone) => milestone.target === target)) {
        milestones.push({ age: years[y], target });
      }
    }
  }
  if (householdSocialSecurityStartAge !== null && householdSocialSecurityStartAge >= currentAge && householdSocialSecurityStartAge <= years[years.length - 1]) {
    milestones.push({ age: householdSocialSecurityStartAge, target: 'SS' });
  }
  if (fireAge !== null) milestones.push({ age: fireAge, target: 'FIRE' });
  milestones.sort((a, b) => a.age - b.age);

  return {
    currentSavings,
    years,
    netWorths,
    fireTargets,
    yearsToRetire,
    annualSavings,
    savingsRate,
    currentEffectiveTaxRate,
    fireNumber,
    retirementFireNumber,
    longevityAge,
    retireBaseExpenses,
    estimatedMedicalAtRetirement,
    estimatedMedicalAtSocialSecurity,
    householdSocialSecurityStartAge,
    socialSecurityClaimAge,
    socialSecurityAnnualBenefit,
    spouseSocialSecurityClaimAge,
    spouseSocialSecurityAnnualBenefit,
    householdSocialSecurityAnnualBenefit,
    bridgePortfolioNeedToday,
    bridgePortfolioNeedAtRetirement,
    netRetireExpensesAfterSocialSecurity,
    postSsPortfolioNeedAtClaim,
    fireAge,
    yearsToFire,
    projectedNetWorth,
    projectionAge,
    capitalAt67,
    capitalAt67Age,
    contributionsAtRetire,
    growthAtRetire,
    contributionsPct,
    growthPct,
    status,
    milestones,
  };
}
