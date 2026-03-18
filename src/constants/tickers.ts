import type { CompositeSplit } from '../types';

export const INTL_TICKERS = new Set(['VXUS','IXUS','VEA','VWO','EFA','EEM','IEFA','IEMG','SPDW','SPEM','SCHF','SCHE','VTIAX','VFWAX']);
export const BOND_TICKERS = new Set(['BND','AGG','BNDX','VBTLX','TLT','IEF','SHY','TIP','VCIT','LQD','HYG','JNK','SCHZ','BIV','BSV','VGSH']);
export const MUNI_TICKERS = new Set(['MUB','VTEB','TFI','HYD','CMF','NYF','SUB','SHM','ITM','MLN','VWITX','VWALX','VTEAX']);
export const REIT_TICKERS = new Set(['VNQ','VNQI','SCHH','IYR','XLRE','RWR','USRT','REET','SRVR']);
export const CASH_TICKERS = new Set(['VMFXX','SPAXX','SWVXX','FDRXX','FZFXX','SPRXX','TTTXX']);
export const CRYPTO_TICKERS = new Set(['GBTC','ETHE','BITO','IBIT','FBTC','ARKB']);

export const COMPOSITE_FUNDS: Record<string, CompositeSplit> = {
  // Vanguard Target Retirement
  VTIVX: { us_stock: 0.36, intl_stock: 0.24, bond: 0.28, cash: 0.12 },
  VFIFX: { us_stock: 0.36, intl_stock: 0.24, bond: 0.28, cash: 0.12 },
  VFFVX: { us_stock: 0.36, intl_stock: 0.24, bond: 0.28, cash: 0.12 },
  VLXVX: { us_stock: 0.36, intl_stock: 0.24, bond: 0.28, cash: 0.12 },
  VFORX: { us_stock: 0.34, intl_stock: 0.22, bond: 0.30, cash: 0.14 },
  VTHRX: { us_stock: 0.30, intl_stock: 0.20, bond: 0.35, cash: 0.15 },
  VTWNX: { us_stock: 0.26, intl_stock: 0.17, bond: 0.40, cash: 0.17 },
  VTINX: { us_stock: 0.18, intl_stock: 0.12, bond: 0.47, cash: 0.23 },
  // Vanguard LifeStrategy
  VASGX: { us_stock: 0.48, intl_stock: 0.32, bond: 0.14, cash: 0.06 },
  VSMGX: { us_stock: 0.36, intl_stock: 0.24, bond: 0.28, cash: 0.12 },
  VSCGX: { us_stock: 0.24, intl_stock: 0.16, bond: 0.42, cash: 0.18 },
  VASIX: { us_stock: 0.12, intl_stock: 0.08, bond: 0.56, cash: 0.24 },
  // Vanguard Balanced
  VBIAX: { us_stock: 0.40, intl_stock: 0.20, bond: 0.40, cash: 0 },
  VBINX: { us_stock: 0.40, intl_stock: 0.20, bond: 0.40, cash: 0 },
  VWELX: { us_stock: 0.45, intl_stock: 0.20, bond: 0.35, cash: 0 },
  VTMFX: { us_stock: 0.50, muni: 0.50 },
  // iShares Allocation ETFs
  AOA: { us_stock: 0.48, intl_stock: 0.32, bond: 0.16, cash: 0.04 },
  AOM: { us_stock: 0.24, intl_stock: 0.16, bond: 0.48, cash: 0.12 },
  AOR: { us_stock: 0.36, intl_stock: 0.24, bond: 0.32, cash: 0.08 },
  AOK: { us_stock: 0.18, intl_stock: 0.12, bond: 0.56, cash: 0.14 },
  // Fidelity Freedom Target Date
  FFFHX: { us_stock: 0.36, intl_stock: 0.24, bond: 0.28, cash: 0.12 },
  FFFGX: { us_stock: 0.34, intl_stock: 0.23, bond: 0.30, cash: 0.13 },
  FFFEX: { us_stock: 0.30, intl_stock: 0.20, bond: 0.35, cash: 0.15 },
  FFFAX: { us_stock: 0.20, intl_stock: 0.13, bond: 0.45, cash: 0.22 },
  // Schwab Target Date
  SWYMX: { us_stock: 0.36, intl_stock: 0.24, bond: 0.28, cash: 0.12 },
};

export const DEFAULT_YIELDS: Record<string, number> = {
  us_stock: 1.3,
  intl_stock: 3.0,
  bond: 3.5,
  muni: 2.5,
  reit: 3.5,
  cash: 4.0,
  crypto: 0,
  other: 1.0,
};
