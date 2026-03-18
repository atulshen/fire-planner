export const FPL_2025 = 15650; // single person, 48 states

// Applicable percentage table: [FPL%, contribution% of income]
export const ACA_CONTRIBUTION_TABLE = [
  { fpl: 1.00, pct: 0.0210 },
  { fpl: 1.33, pct: 0.0314 },
  { fpl: 1.38, pct: 0.0345 },
  { fpl: 1.50, pct: 0.0419 },
  { fpl: 2.00, pct: 0.0660 },
  { fpl: 2.50, pct: 0.0844 },
  { fpl: 3.00, pct: 0.0996 },
  { fpl: 4.00, pct: 0.0996 }, // capped at 9.96% up to 400% FPL
];

// ACA age rating curve (CMS federal default)
export const ACA_AGE_FACTORS: Record<number, number> = {
  0:0.765, 1:0.765, 2:0.765, 3:0.765, 4:0.765, 5:0.765, 6:0.765, 7:0.765,
  8:0.765, 9:0.765, 10:0.765, 11:0.765, 12:0.765, 13:0.765, 14:0.765,
  15:0.765, 16:0.765, 17:0.765, 18:0.765, 19:0.765, 20:0.765,
  21:1.000, 22:1.000, 23:1.000, 24:1.000,
  25:1.004, 26:1.024, 27:1.048, 28:1.087, 29:1.119,
  30:1.135, 31:1.159, 32:1.183, 33:1.198, 34:1.214,
  35:1.222, 36:1.230, 37:1.238, 38:1.246, 39:1.262,
  40:1.278, 41:1.302, 42:1.325, 43:1.357, 44:1.397,
  45:1.444, 46:1.500, 47:1.563, 48:1.635, 49:1.706,
  50:1.786, 51:1.865, 52:1.952, 53:2.040, 54:2.135,
  55:2.230, 56:2.333, 57:2.437, 58:2.548, 59:2.603,
  60:2.714, 61:2.810, 62:2.873, 63:2.952, 64:3.000,
};

// Silver benchmark base premium at age 21 ($625/mo avg Silver at age 40, divided by age-40 factor)
export const SILVER_BASE_21 = 625 / 1.278;

// Gold plan base premium at age 21 ($650/mo avg Gold at age 40)
export const GOLD_BASE_21 = 650 / 1.278;
