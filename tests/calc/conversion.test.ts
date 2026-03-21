import { describe, expect, it } from 'vitest';
import { recommendRothConversion } from '../../src/calc/conversion';

describe('recommendRothConversion', () => {
  it('recommends converting when end-of-life wealth is materially higher', () => {
    expect(recommendRothConversion(5000, 2000)).toEqual({
      action: 'convert',
      driver: 'wealth',
      tone: 'positive',
    });
  });

  it('recommends against converting when end-of-life wealth is materially lower', () => {
    expect(recommendRothConversion(-5000, -2000)).toEqual({
      action: 'do_not_convert',
      driver: 'wealth',
      tone: 'negative',
    });
  });

  it('uses tax savings as the tiebreaker when wealth is roughly flat', () => {
    expect(recommendRothConversion(500, -3000)).toEqual({
      action: 'convert',
      driver: 'tax',
      tone: 'positive',
    });
  });

  it('defaults to no conversion when wealth is flat and taxes are not lower', () => {
    expect(recommendRothConversion(500, 200)).toEqual({
      action: 'do_not_convert',
      driver: 'wealth',
      tone: 'neutral',
    });
  });
});
