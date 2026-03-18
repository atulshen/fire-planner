import { $ } from '../utils/dom';
import { fmtD, fmtK } from '../utils/format';
import { filtered, targets } from '../state/store';
import { getEffectiveAllocation } from '../calc/allocation';
import { CATEGORIES } from '../constants/categories';

export function renderAllocation(): void {
  const list = filtered();
  const totalValue = list.reduce((s, h) => s + h.shares * h.price, 0);

  // Group by category, splitting composite funds
  const byCat: Record<string, number> = {};
  for (const h of list) {
    const alloc = getEffectiveAllocation(h);
    for (const [cat, amt] of Object.entries(alloc)) {
      byCat[cat] = (byCat[cat] || 0) + amt;
    }
  }

  if (totalValue === 0) {
    $('allocationArea').innerHTML = '<div class="empty-state"><p>Add holdings to see allocation.</p></div>';
    return;
  }

  // Draw ring chart via canvas
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  let legendHtml = entries.map(([cat, val]) => {
    const pct = (val / totalValue) * 100;
    const targetPct = (targets as any)[cat] || 0;
    const diff = pct - targetPct;
    const diffStr = targetPct > 0 ? ` <span style="font-size:0.75rem;color:${Math.abs(diff) < 3 ? 'var(--accent)' : 'var(--orange)'}">(target ${targetPct}%)</span>` : '';
    return `<div class="alloc-legend-item">
      <span class="alloc-dot" style="background:${CATEGORIES[cat as keyof typeof CATEGORIES]?.color || '#999'}"></span>
      <span>${CATEGORIES[cat as keyof typeof CATEGORIES]?.label || cat}</span>
      <span class="alloc-legend-pct">${fmtD(pct, 1)}%${diffStr}</span>
    </div>`;
  }).join('');

  $('allocationArea').innerHTML = `
    <div class="alloc-ring-wrap">
      <canvas id="allocCanvas" width="160" height="160" style="width:160px;height:160px;"></canvas>
      <div class="alloc-legend">${legendHtml}</div>
    </div>`;

  // Draw donut
  const canvas = $('allocCanvas') as any;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 160 * dpr;
  canvas.height = 160 * dpr;
  ctx.scale(dpr, dpr);

  const cx = 80, cy = 80, r = 65, inner = 42;
  let startAngle = -Math.PI / 2;

  for (const [cat, val] of entries) {
    const sweep = (val / totalValue) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
    ctx.arc(cx, cy, inner, startAngle + sweep, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = CATEGORIES[cat as keyof typeof CATEGORIES]?.color || '#999';
    ctx.fill();
    startAngle += sweep;
  }

  // Center text
  ctx.fillStyle = '#e4e4e7';
  ctx.font = 'bold 14px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$' + fmtK(totalValue), cx, cy);
}
