import { MEDICARE_BASE, MEDICARE_OOP_BY_AGE, IRMAA_BRACKETS } from '../constants/medicare';

export interface IrmaaSurcharge {
  partB: number;
  partD: number;
  total: number;
}

export interface MedicareAnnualCost {
  premiums: number;
  oop: number;
  irmaa: number;
  total: number;
}

/**
 * Look up IRMAA surcharge for a given MAGI.
 * Searches brackets from lowest to highest; returns the first match.
 */
export function getIrmaaSurcharge(magi: number): IrmaaSurcharge {
  for (const b of IRMAA_BRACKETS) {
    if (magi <= b.maxMagi) {
      return { partB: b.partBSurcharge, partD: b.partDSurcharge, total: b.partBSurcharge + b.partDSurcharge };
    }
  }
  const last = IRMAA_BRACKETS[IRMAA_BRACKETS.length - 1];
  return { partB: last.partBSurcharge, partD: last.partDSurcharge, total: last.partBSurcharge + last.partDSurcharge };
}

/**
 * Compute total annual Medicare cost for a given age, MAGI, inflation rate,
 * and number of years since age 65.
 * Includes base premiums, out-of-pocket, and IRMAA surcharges, all adjusted for inflation.
 */
export function getMedicareAnnualCost(age: number, magi: number, inflation: number, yearsFrom65: number): MedicareAnnualCost {
  const inflationFactor = Math.pow(1 + inflation, yearsFrom65);
  const basePremiums = (MEDICARE_BASE.partB + MEDICARE_BASE.partD + MEDICARE_BASE.partBDeductible + MEDICARE_BASE.medigap) * inflationFactor;
  const oopAge = Math.min(Math.max(age, 65), 100);
  const oop = (MEDICARE_OOP_BY_AGE[oopAge] || 14000) * inflationFactor;
  const irmaa = getIrmaaSurcharge(magi);
  return {
    premiums: Math.round(basePremiums),
    oop: Math.round(oop),
    irmaa: Math.round(irmaa.total * inflationFactor),
    total: Math.round(basePremiums + oop + irmaa.total * inflationFactor),
  };
}
