import type { PlannerPortfolioContext } from './portfolio-balance';

export type PlannerConsistencyStatus = 'validated' | 'warning' | 'caution';

export interface PlannerConsistencyInput {
  plannerFireAge: number | null;
  selectedRetirementAge: number;
  plannerRetireExpenses: number;
  plannerLongevityAge: number;
  drawdownSpending: number;
  drawdownLifeExp: number;
  drawdownDepletionAge: number | null;
  drawdownFinalBalance: number;
  otherAssetsAdjustment: number;
  liabilitiesAdjustment: number;
  portfolioContext: PlannerPortfolioContext;
}

export interface PlannerConsistencyResult {
  status: PlannerConsistencyStatus;
  title: string;
  summary: string;
  drivers: string[];
}

function fmtMoney(value: number): string {
  const rounded = Math.round(value);
  return `${rounded < 0 ? '-$' : '$'}${Math.abs(rounded).toLocaleString('en-US')}`;
}

export function evaluatePlannerConsistency(input: PlannerConsistencyInput): PlannerConsistencyResult {
  const drivers: string[] = [];
  const plannerSaysReady = input.plannerFireAge !== null && input.selectedRetirementAge >= input.plannerFireAge;
  const drawdownFunded = input.drawdownDepletionAge === null || input.drawdownDepletionAge > input.drawdownLifeExp;

  if (input.drawdownSpending > input.plannerRetireExpenses * 1.05) {
    drivers.push(`Drawdown is testing higher annual spending (${fmtMoney(input.drawdownSpending)}) than the planner retirement-expense assumption (${fmtMoney(input.plannerRetireExpenses)}).`);
  }

  if (input.drawdownLifeExp > input.plannerLongevityAge) {
    drivers.push(`Drawdown is testing a longer horizon (through age ${input.drawdownLifeExp}) than the planner longevity assumption (age ${input.plannerLongevityAge}).`);
  }

  if (input.otherAssetsAdjustment !== 0 || input.liabilitiesAdjustment !== 0) {
    drivers.push(`Planner starting net worth includes manual adjustments (${fmtMoney(input.otherAssetsAdjustment)} other assets, ${fmtMoney(input.liabilitiesAdjustment)} liabilities) that are not mapped into specific drawdown accounts.`);
  }

  const iraShare = input.portfolioContext.totalNetWorth > 0
    ? input.portfolioContext.ira / input.portfolioContext.totalNetWorth
    : 0;
  if (iraShare >= 0.45) {
    drivers.push(`A large traditional IRA share (${Math.round(iraShare * 100)}% of starting portfolio) means taxes and future RMDs can make drawdown results weaker than lump-sum planner math.`);
  }

  const taxableCashShare = input.portfolioContext.totalNetWorth > 0
    ? input.portfolioContext.taxableCash / input.portfolioContext.totalNetWorth
    : 0;
  if (taxableCashShare <= 0.05 && input.portfolioContext.taxableInvested > 0) {
    drivers.push('Low taxable cash means the retirement engine has to sell invested assets earlier, which can expose taxes and sequencing drag sooner.');
  }

  if (plannerSaysReady && drawdownFunded) {
    return {
      status: 'validated',
      title: 'Drawdown broadly validates this retirement age',
      summary: `The planner says this age is funded, and the drawdown check does not run out of money before age ${input.drawdownLifeExp}. Estimated ending balance: ${fmtMoney(input.drawdownFinalBalance)}.`,
      drivers,
    };
  }

  if (plannerSaysReady && !drawdownFunded) {
    return {
      status: 'warning',
      title: 'Drawdown does not validate this retirement age',
      summary: `The planner reaches FIRE by age ${input.plannerFireAge}, but the drawdown check runs short by age ${input.drawdownDepletionAge}. Taxes, healthcare timing, account mix, or reconciliation adjustments are likely creating the gap.`,
      drivers,
    };
  }

  if (!plannerSaysReady && drawdownFunded) {
    return {
      status: 'caution',
      title: 'Drawdown survives, but the planner still flags this age as aggressive',
      summary: input.plannerFireAge !== null
        ? `The drawdown check stays funded through age ${input.drawdownLifeExp}, but the planner does not mark the portfolio as retirement-ready until age ${input.plannerFireAge}.`
        : `The drawdown check stays funded through age ${input.drawdownLifeExp}, but the planner never reaches its FIRE threshold under the current assumptions.`,
      drivers,
    };
  }

  return {
    status: 'caution',
    title: 'Both views treat this retirement age as aggressive',
    summary: input.plannerFireAge !== null
      ? `The planner does not reach FIRE until age ${input.plannerFireAge}, and the drawdown check also runs short${input.drawdownDepletionAge !== null ? ` by age ${input.drawdownDepletionAge}` : ''}.`
      : `The planner never reaches its FIRE threshold under the current assumptions, and the drawdown check also runs short${input.drawdownDepletionAge !== null ? ` by age ${input.drawdownDepletionAge}` : ''}.`,
    drivers,
  };
}
