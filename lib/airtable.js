const AT_BASE = 'https://api.airtable.com/v0';

function atHeaders() {
  return {
    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

const FIELDS = [
  { name: 'Date',               type: 'date',          options: { dateFormat: { name: 'iso' } } },
  { name: 'Location',           type: 'singleLineText' },
  { name: 'Type',               type: 'singleLineText' },
  { name: 'Gross Sales',        type: 'currency',      options: { precision: 2, symbol: '$' } },
  { name: 'Net Sales',          type: 'currency',      options: { precision: 2, symbol: '$' } },
  { name: 'Order Count',        type: 'number',        options: { precision: 0 } },
  { name: 'Avg Check',          type: 'currency',      options: { precision: 2, symbol: '$' } },
  { name: 'Total Tips',         type: 'currency',      options: { precision: 2, symbol: '$' } },
  { name: 'Total Hours',        type: 'number',        options: { precision: 1 } },
  { name: 'Labor Cost',         type: 'currency',      options: { precision: 2, symbol: '$' } },
  { name: 'OT Employee Count',  type: 'number',        options: { precision: 0 } },
  { name: 'OT Extra Cost',      type: 'currency',      options: { precision: 2, symbol: '$' } },
  { name: 'Missed Break Count', type: 'number',        options: { precision: 0 } },
  { name: 'Top Item',           type: 'singleLineText' },
  { name: 'Top Item Qty',       type: 'number',        options: { precision: 0 } },
  { name: 'Top Items JSON',     type: 'multilineText' },
  { name: 'Discount Total',     type: 'currency',      options: { precision: 2, symbol: '$' } },
  { name: 'Void Count',         type: 'number',        options: { precision: 0 } },
  { name: 'Void Total',         type: 'currency',      options: { precision: 2, symbol: '$' } },
  { name: 'Overtime',           type: 'multilineText' },
  { name: 'Report URL',         type: 'url' },
];

async function ensureFields(baseId, tableId) {
  for (const field of FIELDS) {
    try {
      await fetch(`${AT_BASE}/meta/bases/${baseId}/tables/${tableId}/fields`, {
        method: 'POST',
        headers: atHeaders(),
        body: JSON.stringify(field),
      });
    } catch {
      // Field already exists — continue
    }
  }
}

// Returns a Set of "YYYY-MM-DD|LocationName" strings for already-written days
export async function fetchExistingDates(baseId, tableId) {
  const existing = new Set();
  let offset = null;

  do {
    const url = new URL(`${AT_BASE}/${baseId}/${tableId}`);
    url.searchParams.set('fields[]', 'Date');
    url.searchParams.set('fields[]', 'Location');
    url.searchParams.set('fields[]', 'Type');
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url.toString(), { headers: atHeaders() });
    if (!res.ok) break;

    const data = await res.json();
    for (const record of (data.records || [])) {
      const date = record.fields?.Date;
      const loc  = record.fields?.Location;
      const type = record.fields?.Type || 'Restaurant';
      if (date && loc) existing.add(`${date}|${loc}|${type}`);
    }
    offset = data.offset || null;
  } while (offset);

  return existing;
}

export async function writeReport(locationData, displayDate, reportUrl, type = 'Restaurant') {
  const baseId  = process.env.JEANNINES_AIRTABLE_BASE_ID;
  const tableId = process.env.JEANNINES_AIRTABLE_TABLE_ID;

  if (!baseId || !tableId) {
    console.warn('  Airtable: base/table ID not set, skipping.');
    return false;
  }

  await ensureFields(baseId, tableId);

  const isRetail = type === 'Retail';
  const records = locationData.map(loc => ({
    fields: {
      'Name':               isRetail ? `${displayDate} — ${loc.name} (Retail)` : `${displayDate} — ${loc.name}`,
      'Date':               displayDate,
      'Location':           loc.name,
      'Type':               type,
      'Gross Sales':        loc.sales.grossSales,
      'Net Sales':          loc.sales.netSales,
      'Order Count':        loc.sales.orderCount,
      'Avg Check':          loc.sales.avgCheck,
      'Total Tips':         loc.sales.tipTotal,
      'Total Hours':        isRetail ? 0 : loc.labor.totalHours,
      'Labor Cost':         isRetail ? 0 : loc.labor.totalLaborCost,
      'OT Employee Count':  isRetail ? 0 : loc.labor.otCount,
      'OT Extra Cost':      isRetail ? 0 : loc.labor.totalOtCost,
      'Missed Break Count': isRetail ? 0 : loc.labor.missedBreakCount,
      'Top Item':           loc.sales.topItems[0]?.name || '',
      'Top Item Qty':       loc.sales.topItems[0]?.qty  || 0,
      'Top Items JSON':     isRetail ? '' : JSON.stringify(loc.sales.topItems.slice(0, 10)),
      'Discount Total':     isRetail ? 0 : (loc.sales.discountTotal || 0),
      'Void Count':         isRetail ? 0 : (loc.voids?.count        || 0),
      'Void Total':         isRetail ? 0 : (loc.voids?.totalAmount  || 0),
      'Overtime':           isRetail ? '' : (loc.labor.overtime
        .map(e => `${e.name}: ${e.hours}h${e.doubleTime ? ' (2×)' : ''}`)
        .join('\n') || 'None'),
      'Report URL':         reportUrl || '',
    },
  }));

  const res = await fetch(`${AT_BASE}/${baseId}/${tableId}`, {
    method: 'POST',
    headers: atHeaders(),
    body: JSON.stringify({ records }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('  Airtable write failed:', err);
    return false;
  }

  return true;
}
