import { $ } from '../utils/dom';
import { fmt, fmtK } from '../utils/format';
import type { FirePlannerResult } from '../calc/fire';

function drawPlannerChart(result: FirePlannerResult): void {
  const canvas = document.getElementById('plannerProjectionChart') as HTMLCanvasElement | null;
  if (!canvas || !canvas.parentElement) return;

  const rect = canvas.parentElement.getBoundingClientRect();
  const w = Math.max(rect.width - 40, 280);
  const h = 280;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 35;
  const cw = w - padL - padR;
  const ch = h - padT - padB;

  const maxVal = Math.max(...result.netWorths, result.fireNumber) * 1.1 || 1;
  const xScale = (i: number) => padL + (i / Math.max(result.years.length - 1, 1)) * cw;
  const yScale = (value: number) => padT + ch - (value / maxVal) * ch;

  ctx.strokeStyle = '#2a2d3a';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const yVal = (maxVal * i) / 5;
    const y = yScale(yVal);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();

    ctx.fillStyle = '#9294a0';
    ctx.font = '11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`$${fmtK(yVal)}`, padL - 8, y + 4);
  }

  ctx.textAlign = 'center';
  const labelStep = Math.max(Math.ceil(result.years.length / 8), 1);
  for (let i = 0; i < result.years.length; i += labelStep) {
    ctx.fillStyle = '#9294a0';
    ctx.fillText(String(result.years[i]), xScale(i), h - 8);
  }

  ctx.strokeStyle = 'rgba(34,197,94,0.27)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(padL, yScale(result.fireNumber));
  ctx.lineTo(w - padR, yScale(result.fireNumber));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#22c55e';
  ctx.font = '10px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`FIRE: $${fmtK(result.fireNumber)}`, padL + 4, yScale(result.fireNumber) - 6);

  if (result.yearsToRetire < result.years.length) {
    const retireX = xScale(result.yearsToRetire);
    ctx.strokeStyle = 'rgba(249,115,22,0.27)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(retireX, padT);
    ctx.lineTo(retireX, h - padB);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f97316';
    ctx.textAlign = 'center';
    ctx.fillText('Retire', retireX, padT - 5);
  }

  ctx.beginPath();
  ctx.moveTo(xScale(0), yScale(0));
  for (let i = 0; i < result.netWorths.length; i++) {
    ctx.lineTo(xScale(i), yScale(Math.max(result.netWorths[i], 0)));
  }
  ctx.lineTo(xScale(result.netWorths.length - 1), yScale(0));
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, padT, 0, h - padB);
  gradient.addColorStop(0, '#22c55e22');
  gradient.addColorStop(1, '#22c55e02');
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < result.netWorths.length; i++) {
    const x = xScale(i);
    const y = yScale(Math.max(result.netWorths[i], 0));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

export function renderPlannerPage(result: FirePlannerResult, shouldDrawChart: boolean): void {
  const statusMap = {
    on_track: { className: 'on-track', label: 'On Track' },
    close: { className: 'behind', label: 'Close' },
    needs_work: { className: 'far', label: 'Needs Work' },
  } as const;
  const status = statusMap[result.status];

  $('plannerStatusBadge').innerHTML = `<div class="planner-status-badge ${status.className}">${status.label}</div>`;

  $('plannerResultsGrid').innerHTML = `
    <div class="stat green">
      <div class="label">FIRE Number</div>
      <div class="value">$${fmtK(result.fireNumber)}</div>
      <div class="sub">Target net worth</div>
    </div>
    <div class="stat ${result.fireAge !== null && result.fireAge <= result.years[result.yearsToRetire] ? 'green' : 'orange'}">
      <div class="label">FIRE Age</div>
      <div class="value">${result.fireAge !== null ? result.fireAge : '60+'}</div>
      <div class="sub">${result.fireAge !== null && result.yearsToFire !== null ? `In ${result.yearsToFire} years` : 'Increase savings rate'}</div>
    </div>
    <div class="stat blue">
      <div class="label">Projected at ${result.years[result.yearsToRetire]}</div>
      <div class="value">$${fmtK(result.netWorthAtRetire)}</div>
      <div class="sub">${result.netWorthAtRetire >= result.fireNumber ? 'Exceeds FIRE number' : `$${fmtK(Math.max(result.fireNumber - result.netWorthAtRetire, 0))} short`}</div>
    </div>
    <div class="stat ${result.savingsRate >= 50 ? 'green' : result.savingsRate >= 25 ? 'orange' : 'red'}">
      <div class="label">Savings Rate</div>
      <div class="value">${result.savingsRate.toFixed(1)}%</div>
      <div class="sub">$${fmtK(Math.max(result.annualSavings, 0))}/yr saved</div>
    </div>
    <div class="stat blue">
      <div class="label">Coast FIRE</div>
      <div class="value">$${fmtK(Math.max(result.coastFireNumber, 0))}</div>
      <div class="sub">${result.currentSavings >= result.coastFireNumber ? 'Already coast FI!' : `$${fmtK(Math.max(result.coastFireNumber - result.currentSavings, 0))} to coast`}</div>
    </div>
    <div class="stat green">
      <div class="label">Safe Withdrawal</div>
      <div class="value">$${fmtK(result.sustainableWithdrawal)}/yr</div>
      <div class="sub">$${fmtK(result.sustainableWithdrawal / 12)}/mo at retirement</div>
    </div>
  `;

  $('plannerBreakdownBar').innerHTML = `
    <div style="width:${result.contributionsPct}%;background:var(--blue)"></div>
    <div style="width:${result.growthPct}%;background:var(--accent)"></div>
  `;

  $('plannerBreakdownLegend').innerHTML = `
    <span><span class="dot" style="background:var(--blue)"></span>Contributions ${result.contributionsPct.toFixed(0)}%</span>
    <span><span class="dot" style="background:var(--accent)"></span>Growth ${result.growthPct.toFixed(0)}%</span>
  `;

  $('plannerMilestoneList').innerHTML = result.milestones.slice(0, 6).map((milestone) => `
    <li>
      <span class="planner-milestone-dot" style="background:${milestone.target === 'FIRE' ? 'var(--accent)' : 'var(--blue)'}"></span>
      <span class="planner-milestone-year">Age ${milestone.age}</span>
      <span class="planner-milestone-desc">${milestone.target === 'FIRE' ? 'FIRE achieved!' : `$${fmtK(milestone.target)} net worth`}</span>
    </li>
  `).join('');

  if (shouldDrawChart) drawPlannerChart(result);
}
