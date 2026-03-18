import { $ } from '../utils/dom';
import { fmt, fmtD } from '../utils/format';
import { filtered, activeAccount } from '../state/store';
import { ACCOUNT_LABELS } from '../constants/categories';

export function renderSummary(): void {
  const list = filtered();
  const totalValue = list.reduce((s, h) => s + h.shares * h.price, 0);
  const totalCost  = list.reduce((s, h) => s + h.shares * h.costBasis, 0);
  const totalGain  = totalValue - totalCost;
  const gainPct    = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const numPositions = list.length;

  // Day change simulation (since we don't have live data, show total gain)
  const cls = totalGain >= 0 ? 'green' : 'red';
  const sign = totalGain >= 0 ? '+' : '';

  $('summaryStats').innerHTML = `
    <div class="stat">
      <div class="label">Total Value</div>
      <div class="value">$${fmt(totalValue)}</div>
      <div class="sub">${numPositions} positions${activeAccount !== 'all' ? ' in ' + ACCOUNT_LABELS[activeAccount as keyof typeof ACCOUNT_LABELS] : ''}</div>
    </div>
    <div class="stat">
      <div class="label">Total Gain/Loss</div>
      <div class="value ${cls}">${sign}$${fmt(totalGain)}</div>
      <div class="sub ${cls}">${sign}${fmtD(gainPct, 1)}% overall</div>
    </div>
    <div class="stat">
      <div class="label">Total Cost Basis</div>
      <div class="value">$${fmt(totalCost)}</div>
      <div class="sub">Amount invested</div>
    </div>
    <div class="stat">
      <div class="label">Largest Position</div>
      <div class="value">${list.length ? list.reduce((a, b) => (a.shares * a.price) > (b.shares * b.price) ? a : b).ticker : '\u2014'}</div>
      <div class="sub">${list.length ? '$' + fmt(Math.max(...list.map(h => h.shares * h.price))) : ''}</div>
    </div>
  `;
}
