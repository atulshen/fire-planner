import { describe, expect, it } from 'vitest';
import { recommendRothConversion } from '../../src/calc/conversion';

describe('recommendRothConversion', () => {
  it('recommends converting when end-of-life wealth is materially higher', () => {
    expect(recommendRothConversion(5000, 2000, null, null)).toEqual({
      action: 'convert',
      driver: 'wealth',
      tone: 'positive',
    });
  });

  it('recommends against converting when end-of-life wealth is materially lower', () => {
    expect(recommendRothConversion(-5000, -2000, null, null)).toEqual({
      action: 'do_not_convert',
      driver: 'wealth',
      tone: 'negative',
    });
  });

  it('uses tax savings as the tiebreaker when wealth is roughly flat', () => {
    expect(recommendRothConversion(500, -3000, null, null)).toEqual({
      action: 'convert',
      driver: 'tax',
      tone: 'positive',
    });
  });

  it('defaults to no conversion when wealth is flat and taxes are not lower', () => {
    expect(recommendRothConversion(500, 200, null, null)).toEqual({
      action: 'do_not_convert',
      driver: 'wealth',
      tone: 'neutral',
    });
  });

  it('recommends against converting when conversions deplete earlier', () => {
    expect(recommendRothConversion(5000, -3000, 82, null)).toEqual({
      action: 'do_not_convert',
      driver: 'depletion',
      tone: 'negative',
    });
  });

  it('recommends converting when conversions avoid depletion', () => {
    expect(recommendRothConversion(-5000, 3000, null, 82)).toEqual({
      action: 'convert',
      driver: 'depletion',
      tone: 'positive',
    });
  });
});
