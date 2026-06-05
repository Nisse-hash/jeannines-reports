import { render } from '../lib/report.js';

function shiftDate(date, delta) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function parseOvertimeField(text) {
  if (!text || text.trim() === 'None') return [];
  return text.split('\n').flatMap(line => {
    const m = line.trim().match(/^(.+?):\s*([\d.]+)h(\s*\(2×\))?$/);
    if (!m) return [];
    const hours = parseFloat(m[2]);
    const doubleTime = !!m[3];
    const otHours = Math.round(Math.max(0, hours - 8) * 100) / 100;
    return [{ name: m[1].trim(), hours, otHours, wage: 0, extraCost: 0, doubleTime }];
  });
}

function notFoundPage(date) {
  const pd = shiftDate(date, -1);
  const nd = shiftDate(date, 1);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>No data — ${date}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
body{background:#0A0A0F;color:#fff;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:.75rem}
h1{color:#C9A84C;font-size:1.4rem}p{color:#666;font-size:.9rem}
.nav{display:flex;gap:.5rem;margin-top:.5rem}
a{display:inline-block;background:#1A1A24;border:1px solid #2A2A3A;color:#C9A84C;font-size:.85rem;padding:.5rem 1rem;border-radius:3px;text-decoration:none;font-weight:600}
a:hover{background:rgba(201,168,76,.12)}
</style></head><body>
<h1>No report for ${date}</h1>
<p>No data was collected for this date.</p>
<div class="nav">
  <a href="/api/report?date=${pd}">← Prev</a>
  <a href="/api/report?date=${nd}">Next →</a>
</div>
</body></html>`;
}

export default async function handler(req, res) {
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send('<p style="color:red">Invalid date format — use YYYY-MM-DD</p>');
  }

  const token   = process.env.AIRTABLE_API_KEY;
  const baseId  = process.env.JEANNINES_AIRTABLE_BASE_ID;
  const tableId = process.env.JEANNINES_AIRTABLE_TABLE_ID;

  const formula = encodeURIComponent(`{Date}='${date}'`);
  const atUrl   = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${formula}&maxRecords=10`;

  let records = [];
  try {
    const resp = await fetch(atUrl, { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    records = data.records || [];
  } catch {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(502).send('<p style="color:red">Airtable request failed</p>');
  }

  const restRec = records.find(r => r.fields.Type === 'Restaurant' || !r.fields.Type);

  if (!restRec) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(notFoundPage(date));
  }

  const f = restRec.fields;

  // Top items — use JSON blob if present, else fall back to single top item
  let topItems = [];
  if (f['Top Items JSON']) {
    try { topItems = JSON.parse(f['Top Items JSON']); } catch {}
  }
  if (!topItems.length && f['Top Item']) {
    topItems = [{ name: f['Top Item'], qty: f['Top Item Qty'] || 0, revenue: 0 }];
  }

  // Discounts — only the total is stored for archive rows
  const discountTotal = f['Discount Total'] || 0;
  const discounts = discountTotal > 0
    ? [{ name: 'Discounts applied', count: 0, total: discountTotal }]
    : [];

  // Voids — only count + total stored for archive rows
  const voidCount = f['Void Count'] || 0;
  const voidTotal = f['Void Total'] || 0;
  const voids = voidTotal > 0
    ? [{ openedAt: null, voidedAt: null, voidedBy: `${voidCount} order${voidCount > 1 ? 's' : ''}`, reason: '', amount: voidTotal }]
    : [];

  const locationData = {
    name: f['Location'] || 'At the Shore',
    sales: {
      grossSales:    f['Gross Sales']  || 0,
      netSales:      f['Net Sales']    || 0,
      orderCount:    f['Order Count']  || 0,
      avgCheck:      f['Avg Check']    || 0,
      tipTotal:      f['Total Tips']   || 0,
      topItems,
      discounts,
      discountTotal,
    },
    labor: {
      totalHours:   f['Total Hours']  || 0,
      totalCost:    f['Labor Cost']   || 0,
      overtime:     parseOvertimeField(f['Overtime'] || ''),
      missedBreaks: [],
    },
    voids: { count: voidCount, totalAmount: voidTotal, voids },
    timeSeries: null,
  };

  const totals = {
    grossSales:  locationData.sales.grossSales,
    netSales:    locationData.sales.netSales,
    orderCount:  locationData.sales.orderCount,
    avgCheck:    locationData.sales.avgCheck,
    tipTotal:    locationData.sales.tipTotal,
    totalHours:  locationData.labor.totalHours,
  };

  const html = render({ locations: [locationData], totals, eightySixedItems: [] }, date);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
}
