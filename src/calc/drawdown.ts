import { RMD_TABLE } from '../constants/tax';

export interface DrawdownParams {
  currentAge: number;
  retireAge: number;
  expenses: number;
  inflation: number;
  returnRate: number;
  taxRate: number;
  ltcgRate: number;
  ssAnnual: number;
  iraBalance: number;
  rothBalance: number;
  taxableBalance: number;
  taxableCostBasis: number;
}

export interface DrawdownYearResult {
  age: number;
  year: number;
  expenses: number;
  ss: number;
  fromTaxable: number;
  fromIra: number;
  fromRoth: number;
  taxesPaid: number;
  rmdAmount: number;
  shortfall: number;
  balTaxable: number;
  balIra: number;
  balRoth: number;
  totalBalance: number;
}

export interface DrawdownSimResult {
  years: DrawdownYearResult[];
  totalTaxPaid: number;
  depletionAge: number | null;
  finalBalance: number;
  totalWithdrawn: number;
  startingBalance: number;
}

/**
 * Look up the RMD distribution factor for a given age.
 * Returns 0 for ages below 73, and 6.4 for ages above 100.
 */
export function getRmdFactor(age: number): number {
  if (age < 73) return 0;
  if (age > 100) return 6.4;
  return RMD_TABLE[age] || 6.4;
}

/**
 * Simulate a retirement drawdown over up to 50 years.
 *
 * Withdrawal ordering:
 *   1. RMD from Traditional IRA (mandatory at 73+)
 *   2. Taxable account (LTCG rate)
 *   3. Traditional IRA (ordinary income tax)
 *   4. Roth IRA (tax-free, last)
 *
 * Before age 59.5: only taxable (avoid 10% early withdrawal penalty).
 */
export function simulateDrawdown(params: DrawdownParams): DrawdownSimResult {
  const {
    currentAge, retireAge, expenses, inflation, returnRate: growth,
    taxRate: ordTax, ltcgRate: ltcgTax, ssAnnual,
    iraBalance, rothBalance, taxableBalance, taxableCostBasis,
  } = params;

  // Grow balances to retirement age
  const yearsToRetire = Math.max(retireAge - currentAge, 0);
  let taxable = taxableBalance * Math.pow(1 + growth, yearsToRetire);
  let taxableBasis = taxableCostBasis * Math.pow(1 + growth * 0.3, yearsToRetire);
  let ira = iraBalance * Math.pow(1 + growth, yearsToRetire);
  let roth = rothBalance * Math.pow(1 + growth, yearsToRetire);

  const years: DrawdownYearResult[] = [];
  const maxYears = 50;
  let age = retireAge;

  for (let y = 0; y < maxYears; y++) {
    const yearExpenses = expenses * Math.pow(1 + inflation, y);
    const ss = age >= 67 ? ssAnnual * Math.pow(1 + inflation, Math.max(0, y - (67 - retireAge))) : 0;
    let needed = Math.max(yearExpenses - ss, 0);

    let fromTaxable = 0, fromIra = 0, fromRoth = 0;
    let taxesPaid = 0;

    // RMD check
    let rmdAmount = 0;
    if (age >= 73 && ira > 0) {
      const factor = getRmdFactor(age);
      rmdAmount = factor > 0 ? ira / factor : 0;
    }

    const canAccessRetirement = age >= 59.5;

    // Step 1: RMD (mandatory, ordinary income)
    if (rmdAmount > 0 && canAccessRetirement) {
      const withdraw = Math.min(rmdAmount, ira);
      const netWithdraw = withdraw * (1 - ordTax);
      const usedForSpending = Math.min(netWithdraw, needed);
      const excessToTaxable = Math.max(netWithdraw - usedForSpending, 0);
      fromIra += withdraw;
      ira -= withdraw;
      taxesPaid += withdraw * ordTax;
      needed -= usedForSpending;
      if (needed < 0) needed = 0;
      taxable += excessToTaxable;
      taxableBasis += excessToTaxable;
    }

    // Step 2: Taxable account
    if (needed > 0 && taxable > 0) {
      const withdraw = Math.min(needed, taxable);
      fromTaxable += withdraw;
      const gainRatio = taxable > 0 ? Math.max(0, 1 - taxableBasis / taxable) : 0;
      taxesPaid += withdraw * gainRatio * ltcgTax;
      taxableBasis -= withdraw * (1 - gainRatio);
      taxable -= withdraw;
      needed -= withdraw;
    }

    // Step 3: Traditional IRA (if accessible)
    if (needed > 0 && ira > 0 && canAccessRetirement) {
      const withdraw = Math.min(needed, ira);
      fromIra += withdraw;
      ira -= withdraw;
      taxesPaid += withdraw * ordTax;
      needed -= withdraw;
    }

    // Step 4: Roth (if accessible, tax-free)
    if (needed > 0 && roth > 0 && canAccessRetirement) {
      const withdraw = Math.min(needed, roth);
      fromRoth += withdraw;
      roth -= withdraw;
      needed -= withdraw;
    }

    const shortfall = needed > 0 ? needed : 0;
    const totalBalance = taxable + ira + roth;

    years.push({
      age,
      year: y + 1,
      expenses: yearExpenses,
      ss,
      fromTaxable, fromIra, fromRoth,
      taxesPaid,
      rmdAmount: age >= 73 ? rmdAmount : 0,
      shortfall,
      balTaxable: taxable,
      balIra: ira,
      balRoth: roth,
      totalBalance,
    });

    if (totalBalance <= 0 && shortfall > 0) {
      // Ran out of money — record a few more years of shortfall then stop
      for (let extra = 1; extra <= 3 && (y + extra) < maxYears; extra++) {
        const futureExpenses = expenses * Math.pow(1 + inflation, y + extra);
        const futureSS = (age + extra) >= 67
          ? ssAnnual * Math.pow(1 + inflation, Math.max(0, (y + extra) - (67 - retireAge)))
          : 0;
        years.push({
          age: age + extra, year: y + 1 + extra,
          expenses: futureExpenses, ss: futureSS,
          fromTaxable: 0, fromIra: 0, fromRoth: 0,
          taxesPaid: 0, rmdAmount: 0,
          shortfall: Math.max(futureExpenses - futureSS, 0),
          balTaxable: 0, balIra: 0, balRoth: 0, totalBalance: 0,
        });
      }
      break;
    }

    // Grow remaining balances
    taxable *= (1 + growth);
    ira *= (1 + growth);
    roth *= (1 + growth);
    if (taxable > 0) taxableBasis *= (1 + growth * 0.3);

    age++;
  }

  // Summary stats
  const totalTaxPaid = years.reduce((s, y) => s + y.taxesPaid, 0);
  const depletionYear = years.find(y => y.totalBalance <= 0 && y.shortfall > 0);
  const depletionAge = depletionYear ? depletionYear.age : null;
  const lastYear = years[years.length - 1];
  const finalBalance = lastYear ? lastYear.totalBalance : 0;
  const totalWithdrawn = years.reduce((s, y) => s + y.fromTaxable + y.fromIra + y.fromRoth, 0);

  return {
    years,
    totalTaxPaid,
    depletionAge,
    finalBalance,
    totalWithdrawn,
    startingBalance: years[0]
      ? (years[0].balTaxable + years[0].balIra + years[0].balRoth + years[0].fromTaxable + years[0].fromIra + years[0].fromRoth)
      : 0,
  };
}
