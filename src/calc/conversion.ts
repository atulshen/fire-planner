export type RothConversionAction = 'convert' | 'do_not_convert';
export type RothConversionDriver = 'wealth' | 'tax';
export type RothConversionTone = 'positive' | 'negative' | 'neutral';

export interface RothConversionRecommendation {
  action: RothConversionAction;
  driver: RothConversionDriver;
  tone: RothConversionTone;
}

const MATERIAL_WEALTH_DIFF = 1000;
const MATERIAL_TAX_DIFF = 1000;

export function recommendRothConversion(
  wealthDiff: number,
  taxDiff: number,
): RothConversionRecommendation {
  if (wealthDiff > MATERIAL_WEALTH_DIFF) {
    return { action: 'convert', driver: 'wealth', tone: 'positive' };
  }
  if (wealthDiff < -MATERIAL_WEALTH_DIFF) {
    return { action: 'do_not_convert', driver: 'wealth', tone: 'negative' };
  }
  if (taxDiff < -MATERIAL_TAX_DIFF) {
    return { action: 'convert', driver: 'tax', tone: 'positive' };
  }
  if (taxDiff > MATERIAL_TAX_DIFF) {
    return { action: 'do_not_convert', driver: 'tax', tone: 'negative' };
  }
  return { action: 'do_not_convert', driver: 'wealth', tone: 'neutral' };
}
