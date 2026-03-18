/**
 * Hard-coded dividend yield estimates (%) for well-known tickers.
 * Used as fallback when live yield data is unavailable or stale.
 */
export const DIVIDEND_YIELDS: Record<string, number> = {
  VTI: 1.3, VOO: 1.3, SPY: 1.3, IVV: 1.3, SCHB: 1.3, ITOT: 1.3,
  VIG: 1.7, SCHD: 3.4, VYM: 2.8, DVY: 3.5, HDV: 3.5, DGRO: 2.3,
  QQQ: 0.6, VGT: 0.6, ARKK: 0, VUG: 0.5,
  VXUS: 3.1, IXUS: 2.9, VEA: 3.0, VWO: 3.2, EFA: 3.0, EEM: 2.5,
  IEFA: 2.9, IEMG: 2.7, SPDW: 3.0, SCHF: 2.9,
  BND: 3.5, AGG: 3.5, BNDX: 3.0, TLT: 4.0, IEF: 3.5, SHY: 4.2,
  TIP: 2.5, VCIT: 4.2, LQD: 4.5, HYG: 5.5, JNK: 6.0, MUB: 2.8,
  VNQ: 3.8, VNQI: 3.5, SCHH: 2.8, O: 5.5,
  VMFXX: 4.8, SPAXX: 4.5, SWVXX: 4.8, FDRXX: 4.5,
};

/**
 * Default yield estimates by asset category (%).
 * Used when no ticker-specific yield is available.
 */
export const CATEGORY_YIELDS: Record<string, number> = {
  us_stock: 1.3,
  intl_stock: 3.0,
  bond: 3.5,
  muni: 2.5,
  reit: 3.5,
  cash: 4.0,
  crypto: 0,
  other: 1.0,
};
