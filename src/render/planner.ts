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

  const maxVal = Math.max(...result.netWorths, ...result.fireTargets) * 1.1 || 1;
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

  ctx.strokeStyle = 'rgba(34,197,94,0.32)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  for (let i = 0; i < result.fireTargets.length; i++) {
    const x = xScale(i);
    const y = yScale(result.fireTargets[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#22c55e';
  ctx.font = '10px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Required: $${fmtK(result.retirementFireNumber)}`, padL + 4, yScale(result.fireTargets[Math.min(result.fireTargets.length - 1, result.yearsToRetire ?? result.fireTargets.length - 1)]) - 6);

  if (result.yearsToRetire !== null && result.yearsToRetire < result.years.length) {
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
    on_track: { className: 'on-track' },
    close: { className: 'behind' },
    needs_work: { className: 'far' },
  } as const;
  const status = statusMap[result.status];
  const yearsAwayLabel =
    result.yearsToFire !== null
      ? `${result.yearsToFire} year${result.yearsToFire === 1 ? '' : 's'} away`
      : 'Not reached';

  $('plannerStatusBadge').innerHTML = `<div class="planner-status-badge ${status.className}">${yearsAwayLabel}</div>`;

  $('plannerResultsGrid').innerHTML = `
    <div class="stat blue">
      <div class="label">Required Capital</div>
      <div class="value">$${fmtK(result.retirementFireNumber)}</div>
      <div class="sub">Amount needed at retirement to fund living plus age-based healthcare through age ${result.longevityAge}</div>
    </div>
    <div class="stat ${result.fireAge !== null ? 'green' : 'orange'}">
      <div class="label">Retirement Age</div>
      <div class="value">${result.fireAge !== null ? result.fireAge : 'Not reached'}</div>
      <div class="sub">${result.fireAge !== null && result.yearsToFire !== null ? `In ${result.yearsToFire} years` : `Still short at age ${result.projectionAge}`}</div>
    </div>
    <div class="stat blue">
      <div class="label">Capital at Retirement</div>
      <div class="value">${result.projectedNetWorth >= 0 ? '$' : '-$'}${fmtK(Math.abs(result.projectedNetWorth))}</div>
      <div class="sub">Projected portfolio balance at age ${result.projectionAge}</div>
    </div>
    <div class="stat blue">
      <div class="label">4% Rule Baseline</div>
      <div class="value">$${fmtK(result.fireNumber)}</div>
      <div class="sub">Rule-of-thumb target for living expenses only, before longevity, healthcare, and Social Security adjustments</div>
    </div>
    <div class="stat ${result.annualSavings >= 0 ? 'green' : 'red'}">
      <div class="label">Amount Saved</div>
      <div class="value">${result.annualSavings >= 0 ? '$' : '-$'}${fmtK(Math.abs(result.annualSavings))}/yr</div>
      <div class="sub">Pre-tax income minus taxes minus current expenses (${result.currentEffectiveTaxRate.toFixed(1)}% effective tax, ${result.savingsRate.toFixed(1)}% of after-tax income)</div>
    </div>
    <div class="stat blue">
      <div class="label">Need After SS Starts</div>
      <div class="value">$${fmtK(result.netRetireExpensesAfterSocialSecurity)}/yr</div>
      <div class="sub">${result.householdSocialSecurityAnnualBenefit > 0 ? `$${fmtK(result.postSsPortfolioNeedAtClaim)}/yr in claim-year dollars after household Social Security starts` : 'No Social Security reduction modeled'}</div>
    </div>
    <div class="stat blue">
      <div class="label">Household Social Security</div>
      <div class="value">${result.householdSocialSecurityAnnualBenefit > 0 ? `$${fmtK(result.householdSocialSecurityAnnualBenefit)}/yr` : 'Off'}</div>
      <div class="sub">${result.householdSocialSecurityAnnualBenefit > 0 ? `${result.householdSocialSecurityStartAge !== null ? `First household benefits start at age ${result.householdSocialSecurityStartAge}. ` : ''}Primary claim age ${result.socialSecurityClaimAge}${result.spouseSocialSecurityAnnualBenefit > 0 && result.spouseSocialSecurityClaimAge !== null ? `, spouse claim age ${result.spouseSocialSecurityClaimAge}` : ''}` : 'No Social Security reduction modeled'}</div>
    </div>
    <div class="stat blue">
      <div class="label">Longevity</div>
      <div class="value">Age ${result.longevityAge}</div>
      <div class="sub">Retirement assets are modeled to last through this age</div>
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
      <span class="planner-milestone-dot" style="background:${milestone.target === 'FIRE' ? 'var(--accent)' : milestone.target === 'SS' ? 'var(--yellow)' : 'var(--blue)'}"></span>
      <span class="planner-milestone-year">Age ${milestone.age}</span>
      <span class="planner-milestone-desc">${milestone.target === 'FIRE' ? 'Retirement ready' : milestone.target === 'SS' ? 'Social Security starts' : `$${fmtK(milestone.target)} net worth`}</span>
    </li>
  `).join('');

  if (shouldDrawChart) drawPlannerChart(result);
}
