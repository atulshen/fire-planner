export interface FirePlannerInputs {
  currentAge: number;
  retireAge: number;
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
  yearsToRetire: number;
  annualSavings: number;
  savingsRate: number;
  fireNumber: number;
  fireAge: number | null;
  yearsToFire: number | null;
  netWorthAtRetire: number;
  coastFireNumber: number;
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

export function calculateFirePlan(inputs: FirePlannerInputs): FirePlannerResult {
  const currentAge = clamp(inputs.currentAge || 0, 18, 100);
  const retireAge = Math.max(inputs.retireAge || currentAge, currentAge);
  const annualIncome = Math.max(inputs.annualIncome || 0, 0);
  const annualExpenses = Math.max(inputs.annualExpenses || 0, 0);
  const currentSavings = Math.max(inputs.currentSavings || 0, 0);
  const returnRate = Math.max(inputs.returnRate || 0, 0) / 100;
  const inflationRate = Math.max(inputs.inflationRate || 0, 0) / 100;
  const withdrawalRate = Math.max(inputs.withdrawalRate || 0, 0.01) / 100;
  const taxRate = clamp(inputs.taxRate || 0, 0, 100) / 100;
  const retireExpenses = Math.max(inputs.retireExpenses || 0, 0);

  const yearsToRetire = Math.max(retireAge - currentAge, 0);
  const netIncome = annualIncome * (1 - taxRate);
  const annualSavings = netIncome - annualExpenses;
  const savingsRate = netIncome > 0 ? (annualSavings / netIncome) * 100 : 0;

  const years: number[] = [];
  const netWorths: number[] = [];
  const contributions: number[] = [];
  const growthAmounts: number[] = [];

  let balance = currentSavings;
  let totalContrib = currentSavings;
  let totalGrowth = 0;

  for (let y = 0; y <= Math.max(yearsToRetire, 40); y++) {
    years.push(currentAge + y);
    netWorths.push(balance);
    contributions.push(totalContrib);
    growthAmounts.push(totalGrowth);

    if (y < yearsToRetire) {
      const growth = balance * returnRate;
      balance += growth + annualSavings;
      totalContrib += annualSavings;
      totalGrowth += growth;
    } else {
      const growth = balance * returnRate;
      balance += growth - retireExpenses;
      totalGrowth += growth;
    }

    if (balance < 0 && y > yearsToRetire) balance = 0;
  }

  const fireNumber = retireExpenses / withdrawalRate;
  const netWorthAtRetire = netWorths[yearsToRetire] || 0;

  let yearsToFire: number | null = null;
  balance = currentSavings;
  for (let y = 0; y <= 60; y++) {
    if (balance >= fireNumber) {
      yearsToFire = y;
      break;
    }
    balance = balance * (1 + returnRate) + annualSavings;
  }

  const fireAge = yearsToFire !== null ? currentAge + yearsToFire : null;
  const coastFireNumber = fireNumber / Math.pow(1 + returnRate, yearsToRetire);
  const sustainableWithdrawal = netWorthAtRetire * withdrawalRate;
  const contributionsAtRetire = contributions[yearsToRetire] ?? currentSavings;
  const growthAtRetire = growthAmounts[yearsToRetire] ?? 0;
  const totalAtRetire = Math.max(netWorthAtRetire, 1);
  const contributionsPct = clamp((contributionsAtRetire / totalAtRetire) * 100, 0, 100);
  const growthPct = 100 - contributionsPct;

  const status: FirePlannerResult['status'] =
    fireAge !== null && fireAge <= retireAge
      ? 'on_track'
      : fireAge !== null && fireAge <= retireAge + 5
        ? 'close'
        : 'needs_work';

  const milestones: FirePlannerMilestone[] = [];
  const targets = [100000, 250000, 500000, 1000000, 2000000];
  balance = currentSavings;
  for (let y = 0; y <= 50; y++) {
    for (const target of targets) {
      if (balance >= target && !milestones.find((milestone) => milestone.target === target)) {
        milestones.push({ age: currentAge + y, target });
      }
    }
    balance = balance * (1 + returnRate) + annualSavings;
  }
  if (fireAge !== null) milestones.push({ age: fireAge, target: 'FIRE' });
  milestones.sort((a, b) => a.age - b.age);

  return {
    currentSavings,
    years,
    netWorths,
    yearsToRetire,
    annualSavings,
    savingsRate,
    fireNumber,
    fireAge,
    yearsToFire,
    netWorthAtRetire,
    coastFireNumber,
    sustainableWithdrawal,
    contributionsAtRetire,
    growthAtRetire,
    contributionsPct,
    growthPct,
    status,
    milestones,
  };
}
