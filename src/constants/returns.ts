import type { CategoryKey } from '../types';

// Nominal long-run planning assumptions by asset class, used only when a
// feature needs a growth estimate from the current holdings mix.
export const CATEGORY_TOTAL_RETURNS: Record<CategoryKey, number> = {
  us_stock: 7.0,
  intl_stock: 6.5,
  bond: 3.5,
  muni: 3.0,
  reit: 6.0,
  cash: 2.5,
  crypto: 0.0,
  other: 5.0,
};
