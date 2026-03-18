import { $, esc } from '../utils/dom';
import { fmtK } from '../utils/format';
import { holdings } from '../state/store';
import { analyzeTaxEfficiency } from '../calc/tax-efficiency';
import { TAX_LOCATION_RULES } from '../constants/tax';
import { CATEGORIES, ACCOUNT_LABELS, ACCOUNT_SHORT_LABELS } from '../constants/categories';

export function renderTaxEfficiency(): void {
  if (holdings.length === 0) {
    $('taxEfficiencyArea').innerHTML = '<div class="empty-state"><p>Add holdings to see tax efficiency analysis.</p></div>';
    return;
  }

  const { results, moves, overallScore } = analyzeTaxEfficiency(holdings);

  // Grade
  let grade: string, gradeColor: string, gradeText: string;
  if (overallScore >= 90) { grade = 'A'; gradeColor = 'var(--accent)'; gradeText = 'Excellent tax efficiency \u2014 your assets are well-placed across accounts.'; }
  else if (overallScore >= 75) { grade = 'B'; gradeColor = 'var(--accent)'; gradeText = 'Good tax efficiency with minor optimization opportunities.'; }
  else if (overallScore >= 60) { grade = 'C'; gradeColor = 'var(--orange)'; gradeText = 'Fair \u2014 some holdings are in suboptimal accounts. See suggestions below.'; }
  else if (overallScore >= 40) { grade = 'D'; gradeColor = 'var(--orange)'; gradeText = 'Poor tax efficiency \u2014 significant savings possible by relocating assets.'; }
  else { grade = 'F'; gradeColor = 'var(--red)'; gradeText = 'Most holdings are in tax-inefficient accounts. Prioritize the moves below.'; }

  // Score ring
  const scoreRingHtml = `
    <div class="tax-score-ring">
      <canvas id="taxScoreCanvas" width="100" height="100"></canvas>
      <div class="tax-score-label">
        <span style="color:${gradeColor}">${overallScore}</span>
        <small>Score</small>
      </div>
    </div>`;

  // Rules reference
  const rulesHtml = `
    <div class="te-rules">
      <div class="te-rule">
        <div class="te-rule-acct" style="color:var(--blue)">Roth IRA / HSA</div>
        <div class="te-rule-items">
          Best for: High-growth stocks, crypto<br>
          Why: Tax-free growth is most valuable for the highest-upside assets
        </div>
      </div>
      <div class="te-rule">
        <div class="te-rule-acct" style="color:var(--purple)">Traditional IRA</div>
        <div class="te-rule-items">
          Best for: Bonds, REITs, cash<br>
          Why: Defers ordinary income tax on interest &amp; non-qualified dividends
        </div>
      </div>
      <div class="te-rule">
        <div class="te-rule-acct" style="color:var(--orange)">Taxable</div>
        <div class="te-rule-items">
          Best for: International stocks, munis, tax-efficient index funds<br>
          Why: Foreign tax credit, muni tax exemption, favorable LTCG rates, tax-loss harvesting
        </div>
      </div>
    </div>`;

  // Moves
  let movesHtml = '';
  if (moves.length > 0) {
    moves.sort((a, b) => (b.severity * b.value) - (a.severity * a.value));
    movesHtml = `<div class="te-section-title">Future Placement Guidance</div>
      <div style="font-size:0.8rem;color:var(--muted);margin-bottom:0.75rem;">These holdings are in suboptimal accounts. Don't sell to relocate (tax hit usually outweighs benefit). Instead, when adding new money or rebalancing, prefer the suggested account.</div>` +
      moves.map(m => `
        <div class="te-move">
          <span class="te-move-ticker">${esc(m.ticker)}</span>
          <span class="te-move-from"><span class="tax-tag ${m.from}">${ACCOUNT_SHORT_LABELS[m.from]}</span></span>
          <span class="te-move-arrow">&#10142;</span>
          <span class="te-move-to"><span class="tax-tag ${m.to}">${ACCOUNT_SHORT_LABELS[m.to]}</span></span>
          <span class="te-move-reason">${TAX_LOCATION_RULES[m.category]?.reason || ''}</span>
        </div>
      `).join('');
  } else {
    movesHtml = `<div style="font-size:0.85rem;color:var(--accent);margin:1rem 0;">All holdings are optimally placed. No moves needed.</div>`;
  }

  // Per-holding breakdown
  const holdingRows = results.map(r => `
    <div class="te-holding-row">
      <div class="te-icon ${r.status}">${r.status === 'ok' ? '&#10003;' : r.status === 'warn' ? '!' : '&#10007;'}</div>
      <div class="te-detail">
        <div class="te-detail-ticker">
          ${esc(r.ticker)}
          <span class="tax-tag ${r.account}">${ACCOUNT_SHORT_LABELS[r.account]}</span>
          <span style="font-size:0.75rem;color:var(--muted);font-weight:400;margin-left:0.3rem;">${CATEGORIES[r.category]?.label || r.category}</span>
        </div>
        <div class="te-detail-msg">${
          r.status === 'ok'
            ? 'Optimal placement'
            : r.status === 'warn'
              ? 'Acceptable, but ' + ACCOUNT_LABELS[r.idealAccount] + ' would be better'
              : 'Misplaced \u2014 should be in ' + ACCOUNT_LABELS[r.idealAccount]
        }</div>
      </div>
      <div class="te-value">$${fmtK(r.value)}</div>
    </div>
  `).join('');

  $('taxEfficiencyArea').innerHTML = `
    <div class="te-header">
      ${scoreRingHtml}
      <div class="te-header-text">
        <div class="te-grade" style="color:${gradeColor}">Grade: ${grade}</div>
        <div class="te-subtitle">${gradeText}</div>
      </div>
    </div>
    ${rulesHtml}
    ${movesHtml}
    <div class="te-section-title">Holding-by-Holding Analysis</div>
    ${holdingRows}
  `;

  // Draw score ring
  drawScoreRing(overallScore, gradeColor);
}

export function drawScoreRing(score: number, color: string): void {
  const canvas = $('taxScoreCanvas') as any;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 100 * dpr;
  canvas.height = 100 * dpr;
  ctx.scale(dpr, dpr);

  const cx = 50, cy = 50, r = 42, lw = 7;

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#2a2d3a';
  ctx.lineWidth = lw;
  ctx.stroke();

  // Score arc
  const angle = (score / 100) * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}
