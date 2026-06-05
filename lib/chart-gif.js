// Generates an animated GIF cycling through each hour of the day-at-a-glance chart.
// Requires 'canvas' (native binary) and 'gifencoder' (pure JS).
// Falls back gracefully to null if canvas is unavailable (e.g. Windows dev paths with special chars).

const W = 540, H = 175;
const PAD = { top: 22, right: 46, bottom: 26, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

function revLabel(n) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + Math.round(n);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawFrame(ctx, labels, revenue, headcount, maxRev, maxPpl, xOf, yRev, yPpl, barW, fi, first, last) {
  // Background
  ctx.fillStyle = '#0A0A0F';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const gy = PAD.top + (CH / 4) * g;
    ctx.beginPath(); ctx.moveTo(PAD.left, gy); ctx.lineTo(PAD.left + CW, gy); ctx.stroke();
  }

  // Revenue bars
  for (let i = first; i <= last; i++) {
    const bh = PAD.top + CH - yRev(revenue[i]);
    if (bh <= 0) continue;
    ctx.fillStyle = i === fi ? '#C9A84C' : 'rgba(201,168,76,0.4)';
    ctx.fillRect(xOf(i) - barW / 2, yRev(revenue[i]), barW, bh);
  }

  // Headcount line
  ctx.strokeStyle = '#4ECDC4';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let isFirst = true;
  for (let i = first; i <= last; i++) {
    const px = xOf(i), py = yPpl(headcount[i]);
    if (isFirst) { ctx.moveTo(px, py); isFirst = false; } else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Dot at active point on headcount line
  ctx.fillStyle = '#4ECDC4';
  ctx.beginPath();
  ctx.arc(xOf(fi), yPpl(headcount[fi]), 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Vertical indicator at active slot
  const vx = xOf(fi);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(vx, PAD.top); ctx.lineTo(vx, PAD.top + CH); ctx.stroke();
  ctx.setLineDash([]);

  // X-axis labels (whole hours only: "7AM", "9AM" etc — those without ":")
  ctx.textAlign = 'center';
  ctx.font = '9px sans-serif';
  for (let i = first; i <= last; i++) {
    const lbl = labels[i];
    if (!lbl.includes(':')) {
      ctx.fillStyle = i === fi ? '#FFFFFF' : '#444444';
      ctx.fillText(lbl, xOf(i), H - 4);
    }
  }

  // Left Y-axis (revenue)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#C9A84C';
  ctx.font = '9px sans-serif';
  for (let g = 0; g <= 3; g++) {
    const val = maxRev * 1.1 * (3 - g) / 3;
    ctx.fillText(revLabel(val), PAD.left - 3, PAD.top + (CH / 3) * g + 3);
  }

  // Right Y-axis (headcount)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#4ECDC4';
  ctx.font = '9px sans-serif';
  for (let g = 0; g <= 3; g++) {
    const val = Math.round(maxPpl * 1.2 * (3 - g) / 3);
    ctx.fillText(val + 'ppl', PAD.left + CW + 3, PAD.top + (CH / 3) * g + 3);
  }

  // Tooltip
  const TW = 115, TH = 62;
  let tx = vx + 8;
  if (tx + TW > W - PAD.right - 4) tx = vx - TW - 8;
  const ty = PAD.top + 4;

  roundRect(ctx, tx, ty, TW, TH, 4);
  ctx.fillStyle = '#1A1A28';
  ctx.fill();
  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Time label in tooltip
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(labels[fi], tx + 9, ty + 16);

  // Staff row
  ctx.fillStyle = '#4ECDC4';
  ctx.fillRect(tx + 9, ty + 26, 9, 9);
  ctx.fillStyle = '#CCCCCC';
  ctx.font = '10px sans-serif';
  ctx.fillText(`${headcount[fi]} staff on floor`, tx + 22, ty + 35);

  // Revenue row
  ctx.fillStyle = '#C9A84C';
  ctx.fillRect(tx + 9, ty + 42, 9, 9);
  ctx.fillStyle = '#CCCCCC';
  ctx.font = '10px sans-serif';
  ctx.fillText(revLabel(revenue[fi]) + ' revenue', tx + 22, ty + 51);
}

export async function generateChartGif(timeSeries) {
  if (!timeSeries || !timeSeries.labels.length) return null;

  // Dynamic imports — gracefully skip if canvas not installed (Windows dev path issue)
  let createCanvas, GIFEncoder;
  try {
    const canvasMod = await import('canvas');
    createCanvas = canvasMod.createCanvas;
    const gifMod = await import('gifencoder');
    GIFEncoder = gifMod.default;
  } catch {
    return null;
  }

  const { labels, revenue, headcount } = timeSeries;
  const n = labels.length;

  // Active range: first and last slot with any activity
  let first = 0, last = n - 1;
  for (let i = 0; i < n; i++) { if (revenue[i] > 0 || headcount[i] > 0) { first = i; break; } }
  for (let i = n - 1; i >= 0; i--) { if (revenue[i] > 0 || headcount[i] > 0) { last = i; break; } }

  // Frame indices: every 2 slots (= 1 hour steps) across active range
  const frameIdxs = [];
  for (let i = first; i <= last; i += 2) frameIdxs.push(i);
  if (frameIdxs[frameIdxs.length - 1] !== last) frameIdxs.push(last);

  // Scales
  const maxRev = Math.max(...revenue.slice(first, last + 1)) || 1;
  const maxPpl = Math.max(...headcount.slice(first, last + 1)) || 1;
  const range = last - first + 1;

  const xOf  = (i) => PAD.left + ((i - first) / Math.max(range - 1, 1)) * CW;
  const yRev = (v) => PAD.top + CH - (v / (maxRev * 1.1)) * CH;
  const yPpl = (v) => PAD.top + CH - (v / (maxPpl * 1.2)) * CH;
  const barW = Math.max(3, CW / range * 0.6);

  // GIF setup
  const encoder = new GIFEncoder(W, H);
  const chunks = [];
  const stream = encoder.createReadStream();
  stream.on('data', chunk => chunks.push(chunk));

  encoder.start();
  encoder.setRepeat(0);   // loop forever
  encoder.setDelay(750);  // ms per frame
  encoder.setQuality(10); // 1 = best, 30 = worst

  for (const fi of frameIdxs) {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    drawFrame(ctx, labels, revenue, headcount, maxRev, maxPpl, xOf, yRev, yPpl, barW, fi, first, last);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  await new Promise(resolve => stream.on('end', resolve));
  return Buffer.concat(chunks);
}
