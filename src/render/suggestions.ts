import { $ } from '../utils/dom';
import { fmt } from '../utils/format';
import { filtered, holdings, targets } from '../state/store';
import { analyzePortfolioRecommendations } from '../calc/tax-efficiency';

function actionLabel(action: string): string {
  switch (action) {
    case 'swap': return 'swap';
    case 'buy': return 'buy';
    case 'harvest': return 'harvest';
    case 'warning': return 'caution';
    default: return 'future';
  }
}

function actionClass(action: string): string {
  switch (action) {
    case 'swap': return 'rebal';
    case 'buy': return 'buy';
    case 'harvest': return 'sell';
    case 'warning': return 'sell';
    default: return 'info';
  }
}

export function renderSuggestions(): void {
  const list = filtered();
  const totalValue = list.reduce((sum, holding) => sum + holding.shares * holding.price, 0);
  if (totalValue === 0) {
    $('suggestionsArea').innerHTML = '<div class="empty-state"><p>Add holdings to see suggestions.</p></div>';
    return;
  }

  const recommendations = analyzePortfolioRecommendations(holdings, targets);
  if (recommendations.length === 0) {
    $('suggestionsArea').innerHTML = '<div class="empty-state"><p>Portfolio is well-balanced. No action needed.</p></div>';
    return;
  }

  const [bestNextMove, ...remaining] = recommendations;
  const doNow = remaining.filter((rec) => rec.bucket === 'do_now');
  const future = remaining.filter((rec) => rec.bucket === 'future');

  const renderRecommendation = (rec: typeof recommendations[number]) => `
    <div class="suggestion">
      <span class="suggestion-action ${actionClass(rec.action)}">${actionLabel(rec.action)}</span>
      <div class="suggestion-detail">
        <div class="suggestion-ticker">${rec.title}</div>
        <div class="suggestion-reason">${rec.summary}</div>
        <div class="suggestion-meta">
          <span>${rec.bucket === 'do_now' ? 'Can do now' : 'Future funding / rebalancing'}</span>
          <span>${rec.taxImpact === 'none' ? 'No tax hit expected' : rec.taxImpact === 'low' ? 'Low tax friction' : 'Would trigger taxable gains'}</span>
          ${rec.estimatedAnnualTaxDragSaved ? `<span>Est. tax drag saved: $${fmt(Math.round(rec.estimatedAnnualTaxDragSaved))}/yr</span>` : ''}
          ${(rec.tags || []).map((tag) => `<span>${tag}</span>`).join('')}
        </div>
      </div>
      <div class="suggestion-amount">$${fmt(Math.round(rec.amount))}</div>
    </div>
  `;

  $('suggestionsArea').innerHTML = `
    <div class="suggestion-best">
      <div class="suggestion-best-label">Best Next Move</div>
      ${renderRecommendation(bestNextMove)}
    </div>
    ${doNow.length > 0 ? `<div class="te-section-title">Can Do Now</div>${doNow.map(renderRecommendation).join('')}` : ''}
    ${future.length > 0 ? `<div class="te-section-title">Future Funding And Placement</div>${future.map(renderRecommendation).join('')}` : ''}
  `;
}
