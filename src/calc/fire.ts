import { estimateGoldPremium } from './aca';
import { getMedicareAnnualCost } from './medicare';

export interface FirePlannerInputs {
  currentAge: number;
  annualIncome: number;
  annualExpenses: number;
  currentSavings: number;
  returnRate: number;
  inflationRate: number;
  withdrawalRate: number;
  taxRate: number;
  retireExpenses: number;
  longevityAge?: number;
  socialSecurityClaimAge?: number;
  socialSecurityBenefit?: number;
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
  fireNumber: number;
  retirementFireNumber: number;
  longevityAge: number;
  retireBaseExpenses: number;
  estimatedMedicalAtRetirement: number;
  estimatedMedicalAtSocialSecurity: number;
  socialSecurityClaimAge: number;
  socialSecurityAnnualBenefit: number;
  bridgePortfolioNeedToday: number;
  bridgePortfolioNeedAtRetirement: number;
  netRetireExpensesAfterSocialSecurity: number;
  postSsPortfolioNeedAtClaim: number;
  fireAge: number | null;
  yearsToFire: number | null;
  projectedNetWorth: number;
  projectionAge: number;
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
const HEALTHCARE_INFLATION = 0.03;

export function calculateFirePlan(inputs: FirePlannerInputs): FirePlannerResult {
  const currentAge = clamp(inputs.currentAge || 0, 18, 100);
  const annualIncome = Math.max(inputs.annualIncome || 0, 0);
  const annualExpenses = Math.max(inputs.annualExpenses || 0, 0);
  const currentSavings = Math.max(inputs.currentSavings || 0, 0);
  const returnRate = Math.max(inputs.returnRate || 0, 0) / 100;
  const inflationRate = Math.max(inputs.inflationRate || 0, 0) / 100;
  const withdrawalRate = Math.max(inputs.withdrawalRate || 0, 0.01) / 100;
  const taxRate = clamp(inputs.taxRate || 0, 0, 100) / 100;
  const retireBaseExpenses = Math.max(inputs.retireExpenses || 0, 0);
  const longevityAge = clamp(inputs.longevityAge || 95, currentAge, MAX_PROJECTION_AGE);
  const socialSecurityClaimAge = inputs.socialSecurityClaimAge === 62 ? 62 : 67;
  const socialSecurityAnnualBenefit = Math.max(inputs.socialSecurityBenefit || 0, 0);

  const netIncome = annualIncome * (1 - taxRate);
  const annualSavings = netIncome - annualExpenses;
  const savingsRate = netIncome > 0 ? (annualSavings / netIncome) * 100 : 0;
  const maxYears = Math.max(longevityAge - currentAge, 0);
  const inflate = (amount: number, yearOffset: number) => amount * Math.pow(1 + inflationRate, Math.max(yearOffset, 0));
  const medicalCostForYear = (yearOffset: number) => {
    const age = currentAge + yearOffset;
    if (age < 65) {
      return estimateGoldPremium(age) * 12 * Math.pow(1 + HEALTHCARE_INFLATION, yearOffset);
    }
    return getMedicareAnnualCost(age, 0, HEALTHCARE_INFLATION, age - 65).total;
  };
  const totalRetirementSpendForYear = (yearOffset: number) => inflate(retireBaseExpenses, yearOffset) + medicalCostForYear(yearOffset);
  const socialSecurityForYear = (yearOffset: number) => {
    const age = currentAge + yearOffset;
    if (socialSecurityAnnualBenefit <= 0 || age < socialSecurityClaimAge) return 0;
    return inflate(socialSecurityAnnualBenefit, yearOffset);
  };
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
    const yearlySavings = netIncome - inflate(annualExpenses, y);
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
      const yearlySavings = netIncome - inflate(annualExpenses, y);
      balance += growth + yearlySavings;
      totalContrib += yearlySavings;
    }

    totalGrowth += growth;

    if (balance < 0 && retired) balance = 0;
  }

  const referenceYear = yearsToRetire ?? projectionYears;
  const retirementFireNumber = fireTargets[referenceYear] ?? fireNumber;
  const projectedNetWorth = netWorths[referenceYear] ?? 0;
  const projectionAge = years[referenceYear] ?? currentAge;
  const estimatedMedicalAtRetirement = medicalCostForYear(referenceYear);
  const bridgePortfolioNeedToday = retireBaseExpenses + medicalCostForYear(0);
  const bridgePortfolioNeedAtRetirement = totalRetirementSpendForYear(referenceYear);
  const claimYearOffset = Math.max(socialSecurityClaimAge - currentAge, 0);
  const estimatedMedicalAtSocialSecurity = medicalCostForYear(claimYearOffset);
  const netRetireExpensesAfterSocialSecurity = Math.max(totalRetirementSpendForYear(claimYearOffset) - socialSecurityForYear(claimYearOffset), 0);
  const postSsPortfolioNeedAtClaim = netRetireExpensesAfterSocialSecurity;
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
  if (socialSecurityAnnualBenefit > 0 && socialSecurityClaimAge >= currentAge && socialSecurityClaimAge <= years[years.length - 1]) {
    milestones.push({ age: socialSecurityClaimAge, target: 'SS' });
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
    fireNumber,
    retirementFireNumber,
    longevityAge,
    retireBaseExpenses,
    estimatedMedicalAtRetirement,
    estimatedMedicalAtSocialSecurity,
    socialSecurityClaimAge,
    socialSecurityAnnualBenefit,
    bridgePortfolioNeedToday,
    bridgePortfolioNeedAtRetirement,
    netRetireExpensesAfterSocialSecurity,
    postSsPortfolioNeedAtClaim,
    fireAge,
    yearsToFire,
    projectedNetWorth,
    projectionAge,
    contributionsAtRetire,
    growthAtRetire,
    contributionsPct,
    growthPct,
    status,
    milestones,
  };
}
