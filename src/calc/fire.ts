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
}

export interface FirePlannerMilestone {
  age: number;
  target: number | 'FIRE';
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
  fireAge: number | null;
  yearsToFire: number | null;
  projectedNetWorth: number;
  projectionAge: number;
  sustainableWithdrawal: number;
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
const MIN_PROJECTION_YEARS = 40;
const POST_RETIREMENT_YEARS = 30;

export function calculateFirePlan(inputs: FirePlannerInputs): FirePlannerResult {
  const currentAge = clamp(inputs.currentAge || 0, 18, 100);
  const annualIncome = Math.max(inputs.annualIncome || 0, 0);
  const annualExpenses = Math.max(inputs.annualExpenses || 0, 0);
  const currentSavings = Math.max(inputs.currentSavings || 0, 0);
  const returnRate = Math.max(inputs.returnRate || 0, 0) / 100;
  const inflationRate = Math.max(inputs.inflationRate || 0, 0) / 100;
  const withdrawalRate = Math.max(inputs.withdrawalRate || 0, 0.01) / 100;
  const taxRate = clamp(inputs.taxRate || 0, 0, 100) / 100;
  const retireExpenses = Math.max(inputs.retireExpenses || 0, 0);

  const netIncome = annualIncome * (1 - taxRate);
  const annualSavings = netIncome - annualExpenses;
  const savingsRate = netIncome > 0 ? (annualSavings / netIncome) * 100 : 0;
  const fireNumber = retireExpenses / withdrawalRate;
  const maxYears = Math.max(MAX_PROJECTION_AGE - currentAge, 0);
  const inflate = (amount: number, yearOffset: number) => amount * Math.pow(1 + inflationRate, Math.max(yearOffset, 0));
  const fireTargetForYear = (yearOffset: number) => inflate(fireNumber, yearOffset);

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
  const projectionYears = yearsToFire !== null
    ? Math.min(maxYears, Math.max(yearsToFire + POST_RETIREMENT_YEARS, MIN_PROJECTION_YEARS))
    : maxYears;

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
      const inflatedRetireExpenses = inflate(retireExpenses, y);
      balance += growth - inflatedRetireExpenses;
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
  const sustainableWithdrawal = projectedNetWorth * withdrawalRate;
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
    fireAge,
    yearsToFire,
    projectedNetWorth,
    projectionAge,
    sustainableWithdrawal,
    contributionsAtRetire,
    growthAtRetire,
    contributionsPct,
    growthPct,
    status,
    milestones,
  };
}
