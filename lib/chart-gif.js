// Generates an animated GIF that scans through the day slot by slot,
// showing revenue bars, headcount + labor lines, a vertical cursor,
// and the live staff list in a right-hand panel.
// Uses @napi-rs/canvas for rendering and gif-encoder-2 for encoding.

import { createCanvas } from '@napi-rs/canvas';
import GIFEncoder from 'gif-encoder-2';

const W = 520, H = 250;
// Chart area bounds
const CL = 44, CT = 30, CR = 352, CB = 215;
const CW = CR - CL, CH = CB - CT;
// Right panel left edge
const PL = 360;

function drawLine(ctx, N, xFn, yFn, color, lineWidth = 2) {
  if (N < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const x = xFn(i), y = yFn(i);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function shortName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
  return parts[0];
}

function fmtRevenue(n) {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '$' + n.toFixed(2);
}

export async function generateChartGif(timeSeries) {
  if (!timeSeries?.labels?.length) return null;

  const { labels, revenue, headcount, laborCost, staff } = timeSeries;
  const n = labels.length;

  // Crop to active range (same logic as before)
  let first = 0, last = n - 1;
  for (let i = 0; i < n; i++) { if (revenue[i] > 0 || headcount[i] > 0) { first = i; break; } }
  let lastPeople = -1;
  for (let i = n - 1; i >= 0; i--) { if (headcount[i] > 0) { lastPeople = i; break; } }
  last = lastPeople >= 0 ? lastPeople : last;
  for (let i = n - 1; i >= 0; i--) { if (revenue[i] > 0) { last = Math.max(last, i); break; } }

  const sLabels    = labels.slice(first, last + 1);
  const sRevenue   = revenue.slice(first, last + 1);
  const sHeadcount = headcount.slice(first, last + 1);
  const sLaborCost = (laborCost || []).slice(first, last + 1);
  const sStaff     = (staff || []).slice(first, last + 1);
  const N = sLabels.length;
  if (!N) return null;

  // Y-axis scales
  const maxY0raw = Math.max(...sRevenue, ...sLaborCost, 100);
  const yStep    = Math.ceil(maxY0raw / 4 / 100) * 100 || 100;
  const maxY0    = yStep * 4;
  const maxY1    = Math.max(...sHeadcount, 1);
  const yRev  = v => CB - Math.max(0, Math.min(v, maxY0) / maxY0) * CH;
  const yHC   = v => CB - Math.max(0, Math.min(v, maxY1) / maxY1) * CH;
  const xCtr  = i => CL + (i + 0.5) * (CW / N);
  const bW    = Math.max(2, CW / N * 0.75);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const encoder = new GIFEncoder(W, H, 'neuquant', true);
  encoder.setDelay(450);
  encoder.setRepeat(0);
  encoder.start();

  for (let fi = 0; fi < N; fi++) {

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, W, H);

    // ── Title ───────────────────────────────────────────────────────────────
    ctx.fillStyle = '#555555';
    ctx.font = '9px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('DAY AT A GLANCE', CL, 18);

    // Legend (compact, right side of title)
    const lgx = CL + 140;
    ctx.fillStyle = '#4ECDC4'; ctx.fillRect(lgx,      12, 10, 2);
    ctx.fillStyle = '#888888'; ctx.font = '8px Arial';
    ctx.fillText('Staff', lgx + 13, 15);
    ctx.fillStyle = '#FF6B6B'; ctx.fillRect(lgx + 50, 12, 10, 2);
    ctx.fillText('Labor', lgx + 63, 15);
    ctx.fillStyle = 'rgba(201,168,76,0.75)'; ctx.fillRect(lgx + 106, 9, 7, 7);
    ctx.fillStyle = '#888888'; ctx.fillText('Revenue', lgx + 116, 15);

    // ── Gridlines ───────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const gy = CT + (CH / 4) * g;
      ctx.beginPath(); ctx.moveTo(CL, gy); ctx.lineTo(CR, gy); ctx.stroke();
    }

    // Y-axis tick labels (revenue scale)
    ctx.textAlign = 'right';
    ctx.font = '8px Arial';
    for (let g = 0; g <= 4; g++) {
      const v = yStep * (4 - g);
      const gy = CT + (CH / 4) * g + 3;
      ctx.fillStyle = '#C9A84C';
      const lbl = v >= 1000 ? '$' + (v / 1000).toFixed(0) + 'k' : '$' + v;
      ctx.fillText(lbl, CL - 4, gy);
    }
    ctx.textAlign = 'left';

    // ── Revenue bars ────────────────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const isCurrent = i === fi;
      ctx.fillStyle = isCurrent ? 'rgba(201,168,76,0.88)' : 'rgba(201,168,76,0.38)';
      const bx  = xCtr(i) - bW / 2;
      const byT = yRev(sRevenue[i]);
      const bH  = CB - byT;
      if (bH > 0) ctx.fillRect(bx, byT, bW, bH);
    }

    // ── Labor cost line ──────────────────────────────────────────────────────
    drawLine(ctx, N, xCtr, i => yRev(sLaborCost[i]), 'rgba(255,107,107,0.55)', 1.5);

    // ── Headcount line ───────────────────────────────────────────────────────
    drawLine(ctx, N, xCtr, i => yHC(sHeadcount[i]), '#4ECDC4', 2);

    // ── Vertical cursor ──────────────────────────────────────────────────────
    const cx = xCtr(fi);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(cx - bW / 2 - 1, CT, bW + 2, CH);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(cx, CT); ctx.lineTo(cx, CB); ctx.stroke();
    ctx.restore();

    // Dots on lines at cursor position
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath(); ctx.arc(cx, yRev(sLaborCost[fi]), 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4ECDC4';
    ctx.beginPath(); ctx.arc(cx, yHC(sHeadcount[fi]), 3, 0, Math.PI * 2); ctx.fill();

    // ── X-axis baseline + labels ─────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(CL, CB); ctx.lineTo(CR, CB); ctx.stroke();

    ctx.fillStyle = '#3A3A50';
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i < N; i++) {
      const lbl = sLabels[i];
      if (!lbl.includes(':')) ctx.fillText(lbl, xCtr(i), CB + 11);
    }
    ctx.textAlign = 'left';

    // ── Panel divider ────────────────────────────────────────────────────────
    ctx.strokeStyle = '#1C1C2C';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PL - 6, 8); ctx.lineTo(PL - 6, H - 8); ctx.stroke();

    // ── Right panel content ──────────────────────────────────────────────────
    const time   = sLabels[fi];
    const people = sHeadcount[fi];
    const rev    = sRevenue[fi];
    const labor  = sLaborCost[fi];
    const names  = sStaff[fi] || [];

    // Current time — large gold
    ctx.fillStyle = '#C9A84C';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(time, PL, 27);

    // People count — teal
    ctx.fillStyle = '#4ECDC4';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(`${people} ${people === 1 ? 'person' : 'people'}`, PL, 45);

    // Revenue — white
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px Arial';
    ctx.fillText(fmtRevenue(rev), PL, 60);

    // Labor — dim red
    ctx.fillStyle = '#AA4444';
    ctx.font = '9px Arial';
    ctx.fillText('$' + labor.toFixed(2) + ' labor', PL, 74);

    // Separator
    ctx.fillStyle = '#1E1E30';
    ctx.fillRect(PL, 81, W - PL - 6, 1);

    // Staff names list
    const maxShow = 14;
    const shown   = names.slice(0, maxShow);
    ctx.font = '8.5px Arial';
    shown.forEach((name, j) => {
      ctx.fillStyle = j % 2 === 0 ? '#CCCCCC' : '#999999';
      ctx.fillText(shortName(name), PL, 93 + j * 11);
    });
    if (names.length > maxShow) {
      ctx.fillStyle = '#555555';
      ctx.font = '8px Arial';
      ctx.fillText(`+${names.length - maxShow} more`, PL, 93 + maxShow * 11);
    }
    if (names.length === 0) {
      ctx.fillStyle = '#333333';
      ctx.font = '8px Arial';
      ctx.fillText('No staff on floor', PL, 93);
    }

    encoder.addFrame(ctx);
  }

  encoder.finish();
  const buf = encoder.out.getData();
  console.log(`  Animated GIF: ${Math.round(buf.length / 1024)} KB, ${N} frames @ 450ms`);
  return Buffer.from(buf);
}
