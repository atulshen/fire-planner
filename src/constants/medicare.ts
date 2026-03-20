import { PLANNING_BASE_YEAR } from './planning';

export interface MedicareBase {
  partB: number;
  partD: number;
  partBDeductible: number;
  medigap: number;
}

export interface IrmaaBracket {
  maxMagi: number;
  partBSurcharge: number;
  partDSurcharge: number;
}

export const MEDICARE_BASE: MedicareBase = {
  partB: 2435,       // $202.90/mo x 12
  partD: 414,        // $34.50/mo avg
  partBDeductible: 283,
  medigap: 2400,     // ~$200/mo avg supplemental
};

// Average OOP service costs by age (premiums excluded, 2026 est.)
// Source: KFF data (2022) adjusted ~8% for 2026 inflation
export const MEDICARE_OOP_BY_AGE: Record<number, number> = {
  65: 1600, 66: 1650, 67: 1700, 68: 1800, 69: 1900,
  70: 2000, 71: 2100, 72: 2200, 73: 2350, 74: 2500,
  75: 2700, 76: 2900, 77: 3100, 78: 3350, 79: 3600,
  80: 3900, 81: 4200, 82: 4500, 83: 4900, 84: 5300,
  85: 5800, 86: 6300, 87: 6800, 88: 7400, 89: 8000,
  90: 8700, 91: 9300, 92: 9900, 93: 10500, 94: 11000,
  95: 11500, 96: 12000, 97: 12500, 98: 13000, 99: 13500, 100: 14000,
};

// IRMAA surcharge brackets (2026, based on MAGI from 2 years prior)
export const IRMAA_BRACKETS: IrmaaBracket[] = [
  { maxMagi: 106000, partBSurcharge: 0,      partDSurcharge: 0 },
  { maxMagi: 133000, partBSurcharge: 972,     partDSurcharge: 149 },
  { maxMagi: 167000, partBSurcharge: 2434,    partDSurcharge: 385 },
  { maxMagi: 200000, partBSurcharge: 3895,    partDSurcharge: 622 },
  { maxMagi: 500000, partBSurcharge: 5356,    partDSurcharge: 858 },
  { maxMagi: Infinity, partBSurcharge: 5965,  partDSurcharge: 943 },
];

export const MEDICARE_PLANNING_BASELINE_LABEL = `${PLANNING_BASE_YEAR} planning baseline`;
