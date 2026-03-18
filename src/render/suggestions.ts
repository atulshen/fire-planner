import { $ } from '../utils/dom';
import { fmt, fmtD } from '../utils/format';
import { holdings, filtered, targets } from '../state/store';
import { getEffectiveAllocation } from '../calc/allocation';
import { analyzeTaxEfficiency } from '../calc/tax-efficiency';
import { CATEGORIES } from '../constants/categories';

export function renderSuggestions(): void {
  const list = filtered();
  const totalValue = list.reduce((s, h) => s + h.shares * h.price, 0);
  if (totalValue === 0) {
    $('suggestionsArea').innerHTML = '<div class="empty-state"><p>Add holdings to see suggestions.</p></div>';
    return;
  }

  // Compute actual vs target allocations (splitting composite funds)
  const byCat: Record<string, number> = {};
  for (const cat of Object.keys(CATEGORIES)) byCat[cat] = 0;
  for (const h of list) {
    const alloc = getEffectiveAllocation(h);
    for (const [cat, amt] of Object.entries(alloc)) {
      byCat[cat] = (byCat[cat] || 0) + amt;
    }
  }

  const suggestions: any[] = [];

  for (const [cat, targetPct] of Object.entries(targets)) {
    const actualPct = (byCat[cat] / totalValue) * 100;
    const diff = actualPct - targetPct;
    const diffVal = (diff / 100) * totalValue;

    if (Math.abs(diff) < 2) continue; // within tolerance

    if (diff > 0) {
      // Overweight
      suggestions.push({
        action: 'info',
        category: cat,
        label: CATEGORIES[cat as keyof typeof CATEGORIES]?.label || cat,
        amount: Math.abs(diffVal),
        reason: `Overweight by ${fmtD(Math.abs(diff), 1)}% ($${fmt(Math.abs(diffVal))}). Direct new contributions to underweight categories instead of selling (avoid taxable events).`,
      });
    } else {
      // Underweight
      suggestions.push({
        action: 'buy',
        category: cat,
        label: CATEGORIES[cat as keyof typeof CATEGORIES]?.label || cat,
        amount: Math.abs(diffVal),
        reason: `Underweight by ${fmtD(Math.abs(diff), 1)}% \u2014 add $${fmt(Math.abs(diffVal))} to reach ${targetPct}% target`,
      });
    }
  }

  // Tax-location GUIDANCE
  const taxAnalysis = analyzeTaxEfficiency(holdings);
  const misplaced = taxAnalysis.moves.filter(m => m.severity >= 2);
  if (misplaced.length > 0) {
    const cats = [...new Set(misplaced.map(m => CATEGORIES[m.category as keyof typeof CATEGORIES]?.label || m.category))].join(', ');
    suggestions.push({
      action: 'info',
      category: 'other',
      label: 'Tax Location Opportunity',
      amount: misplaced.reduce((s, m) => s + m.value, 0),
      reason: `${cats} in suboptimal accounts. When adding NEW money, buy tax-inefficient assets (bonds, REITs) in IRA; stocks in Roth/taxable; munis in taxable. Don't sell existing positions just to relocate \u2014 the tax hit usually outweighs the benefit.`,
    });
  }

  // Tax-loss harvesting (any positions with losses in taxable)
  const taxableLosers = holdings.filter(h => h.account === 'taxable' && h.price < (h.costBasis || h.price));
  for (const h of taxableLosers) {
    const loss = ((h.costBasis || h.price) - h.price) * h.shares;
    if (loss > 100) {
      suggestions.push({
        action: 'sell',
        category: h.category,
        label: 'Tax-Loss Harvest',
        amount: loss,
        reason: `${h.ticker} has $${fmt(loss)} unrealized loss in taxable \u2014 sell to harvest tax loss and buy similar ETF`,
      });
    }
  }

  if (suggestions.length === 0) {
    $('suggestionsArea').innerHTML = '<div class="empty-state"><p>Portfolio is well-balanced. No action needed.</p></div>';
    return;
  }

  suggestions.sort((a: any, b: any) => b.amount - a.amount);

  $('suggestionsArea').innerHTML = suggestions.map((s: any) => `
    <div class="suggestion">
      <span class="suggestion-action ${s.action}">${s.action}</span>
      <div class="suggestion-detail">
        <div class="suggestion-ticker">${s.label}</div>
        <div class="suggestion-reason">${s.reason}</div>
      </div>
      <div class="suggestion-amount">$${fmt(s.amount)}</div>
    </div>
  `).join('');
}
