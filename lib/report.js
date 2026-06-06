const $ = (n) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const num = (n) => n.toLocaleString('en-US');

function metricsGrid(cells) {
  return `<div class="metrics-grid">${cells.map(([label, value]) => `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
    </div>`).join('')}
  </div>`;
}

let tableId = 0;
function catPill(cat) {
  if (!cat) return '';
  const lower = cat.toLowerCase();
  const color = lower.includes('non-food') || lower.includes('nonfood') ? '#C9A84C'
              : lower.includes('food') ? '#4ECDC4'
              : '#666';
  const bg = lower.includes('non-food') || lower.includes('nonfood') ? 'rgba(201,168,76,.12)'
           : lower.includes('food') ? 'rgba(78,205,196,.12)'
           : 'rgba(255,255,255,.06)';
  const label = cat.replace(/^Retail\s+/i, '');
  return `<span style="display:inline-block;font-size:.65rem;font-weight:600;padding:.2rem .55rem;border-radius:4px;color:${color};background:${bg};border:1px solid ${color}33;white-space:nowrap">${label}</span>`;
}

function topItemsTable(items) {
  if (!items.length) return '<p class="empty">No item data available.</p>';
  const id = `items-${tableId++}`;
  const fmtR = n => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const hasType = items.some(it => it.category);
  const sorted = [...items].sort((a, b) => b.qty - a.qty);
  const defaultRows = sorted.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td>${i + 1}</td>
      <td>${item.name}</td>
      ${hasType ? `<td>${catPill(item.category)}</td>` : ''}
      <td>${item.qty}</td>
      <td>${fmtR(item.revenue)}</td>
    </tr>`).join('');
  return `
    <div class="table-toolbar">
      <span class="sort-label">Sort by</span>
      <button class="sort-btn active" onclick="sortItems('${id}','qty')">Quantity</button>
      <button class="sort-btn" onclick="sortItems('${id}','revenue')">Revenue</button>
    </div>
    <table class="data-table" id="${id}">
      <thead><tr><th>#</th><th>Item</th>${hasType ? '<th>Type</th>' : ''}<th class="col-qty">Qty</th><th>Revenue</th></tr></thead>
      <tbody>${defaultRows}</tbody>
    </table>
    <script>
    (function(){
      const raw = ${JSON.stringify(items)};
      window['${id}'] = raw;
      setTimeout(function(){ sortItems('${id}', 'qty'); }, 0);
    })();
    </script>`;
}

function alertsBlock(labor) {
  const hasOT = labor.overtime.length > 0;
  const hasMissed = labor.missedBreaks.length > 0;
  if (!hasOT && !hasMissed) return '<div class="all-clear">✓ No overtime &nbsp;·&nbsp; ✓ All breaks taken</div>';

  const otRows = labor.overtime.map((e, i) => {
    const otMins = Math.round(e.otHours * 60);
    const otDisplay = e.otHours >= 1 ? `+${e.otHours}h OT` : `+${otMins}min OT`;
    const wageStr = e.wage ? `$${e.wage.toFixed(2)}/h` : '';
    const extraStr = e.extraCost > 0 ? `+$${e.extraCost.toFixed(2)}` : '';
    return `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td><span class="emp-name">${e.name}</span>${wageStr ? `<br><span class="wage-tag">${wageStr}</span>` : ''}</td>
      <td>${e.hours}h &nbsp;<span class="${e.doubleTime ? 'dt' : 'ot'} ot-pill">${otDisplay}</span></td>
      <td class="extra-cost">${extraStr}</td>
    </tr>`;
  }).join('');

  const breakRows = labor.missedBreaks.map((e, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td>${e.name}</td>
      <td><strong>${e.hours}h shift</strong></td>
      <td class="missed">${e.waived ? 'Waived' : 'No break recorded'}</td>
    </tr>`).join('');

  return `
    ${hasOT ? `
    <div class="alert-card ot-card">
      <div class="alert-title">Overtime — ${labor.overtime.length} employee${labor.overtime.length > 1 ? 's' : ''}</div>
      <table class="data-table">
        <thead><tr><th>Employee</th><th>Shift &amp; OT</th><th>Extra cost</th></tr></thead>
        <tbody>${otRows}</tbody>
      </table>
    </div>` : ''}
    ${hasMissed ? `
    <div class="alert-card break-card">
      <div class="alert-title">Missed Breaks — ${labor.missedBreaks.length} employee${labor.missedBreaks.length > 1 ? 's' : ''} &nbsp;<span class="legal-note">(CA law: break before 5th hour)</span></div>
      <table class="data-table">
        <thead><tr><th>Employee</th><th>Shift</th><th>Status</th></tr></thead>
        <tbody>${breakRows}</tbody>
      </table>
    </div>` : ''}`;
}

function discountsSection(discounts) {
  if (!discounts || !discounts.length) return '<p class="empty">No discounts applied.</p>';
  const rows = discounts.map((d, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td>${d.name}</td>
      <td style="text-align:center">${d.count}</td>
      <td style="color:#C9A84C;font-weight:600">${$(d.total)}</td>
    </tr>`).join('');
  const total = discounts.reduce((s, d) => s + d.total, 0);
  return `
    <table class="data-table">
      <thead><tr><th>Discount Program</th><th style="text-align:center">Times Applied</th><th>Amount Off</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="color:#999;font-size:.8rem;padding:.5rem .75rem">Total discounted</td>
        <td style="color:#C9A84C;font-weight:700;padding:.5rem .75rem">${$(total)}</td>
      </tr></tfoot>
    </table>`;
}

function voidsSection(voidData) {
  if (!voidData || !voidData.count) return null;
  const meaningful = (voidData.voids || []).filter(v => v.amount > 0);
  if (!meaningful.length) return null;
  const fmtTime = iso => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
    });
  };
  const total = meaningful.reduce((s, v) => s + v.amount, 0);
  const rows = meaningful.map((v, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td>${fmtTime(v.openedAt)}</td>
      <td>${fmtTime(v.voidedAt)}</td>
      <td><strong>${v.voidedBy}</strong></td>
      <td style="color:#999">${v.reason || '—'}</td>
      <td style="color:#FF6B6B;font-weight:600">${$(v.amount)}</td>
    </tr>`).join('');
  return `
    <div class="alert-card" style="background:rgba(255,107,107,.07);border:1px solid rgba(255,107,107,.35)">
      <div class="alert-title" style="color:#FF6B6B">
        Voided Orders — ${meaningful.length} order${meaningful.length > 1 ? 's' : ''} &nbsp;·&nbsp; ${$(total)} total
      </div>
      <table class="data-table">
        <thead><tr><th>Opened</th><th>Voided At</th><th>Voided By</th><th>Reason</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function eightySixSection(items) {
  if (!items || !items.length) return '<div class="all-clear">✓ All items in stock</div>';
  const list = items.map(i =>
    `<li style="padding:.3rem 0;color:#e0e0e0;font-size:.875rem">· ${i.name || i.menuItemName || i.guid}</li>`
  ).join('');
  return `
    <div class="alert-card" style="background:rgba(240,180,41,.07);border:1px solid rgba(240,180,41,.3)">
      <div class="alert-title" style="color:#F0B429">
        86'd — ${items.length} item${items.length > 1 ? 's' : ''} out of stock
      </div>
      <ul style="list-style:none;padding:0;margin:0">${list}</ul>
    </div>`;
}

function retailCatBadge(cat) {
  const isFd  = cat === 'Food';
  const color = isFd ? '#4ECDC4' : '#C9A84C';
  const bg    = isFd ? 'rgba(78,205,196,.1)'  : 'rgba(201,168,76,.1)';
  const bdr   = isFd ? 'rgba(78,205,196,.25)' : 'rgba(201,168,76,.25)';
  return `<span style="font-size:.65rem;font-weight:600;color:${color};background:${bg};border:1px solid ${bdr};padding:.1rem .4rem;border-radius:3px;white-space:nowrap">${cat}</span>`;
}

function retailAllTable(items, id) {
  if (!items.length) return '<p class="empty">No retail items sold.</p>';
  const fmtR = n => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sorted = [...items].sort((a, b) => b.qty - a.qty);
  const rows = sorted.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td>${i + 1}</td>
      <td>${item.name}</td>
      <td>${retailCatBadge(item.category)}</td>
      <td>${item.qty}</td>
      <td>${fmtR(item.revenue)}</td>
    </tr>`).join('');
  return `
    <table class="data-table" id="${id}">
      <thead><tr><th>#</th><th>Item</th><th>Type</th><th class="col-qty">Qty</th><th>Revenue</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>
    (function(){ window['${id}'] = ${JSON.stringify(items)}; })();
    </script>`;
}

function retailTopItemsSection(retailLocations) {
  if (!retailLocations || !retailLocations.length) return '';

  const mergedItems   = {};
  const mergedTotals  = {};
  for (const loc of retailLocations) {
    for (const [cat, catData] of Object.entries(loc.topItemsByCategory || {})) {
      const items    = Array.isArray(catData) ? catData : (catData.items || []);
      const totQty   = Array.isArray(catData) ? 0 : (catData.totalQty   || 0);
      const totRev   = Array.isArray(catData) ? 0 : (catData.totalRevenue || 0);
      if (!mergedItems[cat])  mergedItems[cat]  = {};
      if (!mergedTotals[cat]) mergedTotals[cat] = { qty: 0, revenue: 0 };
      mergedTotals[cat].qty     += totQty;
      mergedTotals[cat].revenue += totRev;
      for (const item of items) {
        if (!mergedItems[cat][item.name]) mergedItems[cat][item.name] = { name: item.name, qty: 0, revenue: 0 };
        mergedItems[cat][item.name].qty     += item.qty;
        mergedItems[cat][item.name].revenue += item.revenue;
      }
    }
  }

  const foodItems    = Object.values(mergedItems['Retail Food']     || {}).sort((a, b) => b.qty - a.qty).slice(0, 20);
  const nonFoodItems = Object.values(mergedItems['Retail Non-Food'] || {}).sort((a, b) => b.qty - a.qty).slice(0, 20);

  const foodTot   = mergedTotals['Retail Food']     || { qty: 0, revenue: 0 };
  const nfTot     = mergedTotals['Retail Non-Food'] || { qty: 0, revenue: 0 };
  const allTot    = { qty: foodTot.qty + nfTot.qty, revenue: Math.round((foodTot.revenue + nfTot.revenue) * 100) / 100 };

  if (!foodItems.length && !nonFoodItems.length) return '';

  // Build All list with category tag per item
  const allMap = {};
  for (const item of foodItems)    allMap[item.name] = { name: item.name, qty: item.qty, revenue: item.revenue, category: 'Food' };
  for (const item of nonFoodItems) {
    if (allMap[item.name]) { allMap[item.name].qty += item.qty; allMap[item.name].revenue += item.revenue; }
    else allMap[item.name] = { name: item.name, qty: item.qty, revenue: item.revenue, category: 'Non-Food' };
  }
  const allItems = Object.values(allMap).sort((a, b) => b.qty - a.qty).slice(0, 20);

  // Totals summary bar
  const totalsBar = `
  <div class="retail-totals">
    <div class="rt-card">
      <div class="rt-label">Retail Food</div>
      <div class="rt-value">${$(foodTot.revenue)}</div>
      <div class="rt-sub">${foodTot.qty} items sold</div>
    </div>
    <div class="rt-card">
      <div class="rt-label">Retail Non-Food</div>
      <div class="rt-value">${$(nfTot.revenue)}</div>
      <div class="rt-sub">${nfTot.qty} items sold</div>
    </div>
    <div class="rt-card rt-total">
      <div class="rt-label">Total Retail</div>
      <div class="rt-value">${$(allTot.revenue)}</div>
      <div class="rt-sub">${allTot.qty} items sold</div>
    </div>
  </div>`;

  const foodTable    = foodItems.length    ? topItemsTable(foodItems)    : '<p class="empty">No food items sold.</p>';
  const nonFoodTable = nonFoodItems.length ? topItemsTable(nonFoodItems) : '<p class="empty">No non-food items sold.</p>';
  const allTableId   = `items-${tableId++}`;
  const allTable     = allItems.length ? retailAllTable(allItems, allTableId) : '<p class="empty">No retail items sold.</p>';

  return `
  <div class="location-block" style="border:1px solid rgba(78,205,196,.2)">
    <h2 class="loc-name" style="color:#4ECDC4;border-bottom-color:rgba(78,205,196,.15)">Retail Top Sellers</h2>

    ${totalsBar}

    <div class="retail-controls">
      <div class="retail-toggle">
        <button class="rtgl-btn" data-view="split" onclick="setRetailView('split')">Food &amp; Non-Food</button>
        <button class="rtgl-btn" data-view="food" onclick="setRetailView('food')">Food</button>
        <button class="rtgl-btn" data-view="nonfood" onclick="setRetailView('nonfood')">Non-Food</button>
        <button class="rtgl-btn active" data-view="all" onclick="setRetailView('all')">All</button>
      </div>
      <div id="retail-sort-bar" class="retail-sort-inline">
        <span class="sort-label">Sort by</span>
        <button class="sort-btn active" onclick="sortRetailAll('${allTableId}','qty')">Quantity</button>
        <button class="sort-btn" onclick="sortRetailAll('${allTableId}','revenue')">Revenue</button>
      </div>
    </div>

    <div id="retail-cols" class="retail-grid" style="display:none">
      <div id="retail-col-food">
        <h3 style="color:#4ECDC4">Retail Food</h3>
        ${foodTable}
      </div>
      <div id="retail-col-nonfood">
        <h3 style="color:#4ECDC4">Retail Non-Food</h3>
        ${nonFoodTable}
      </div>
    </div>

    <div id="retail-all-view">
      ${allTable}
    </div>
  </div>`;
}

let chartId = 0;
function chartSection(ts) {
  if (!ts) return '';
  const id = `chart-${chartId++}`;
  const panelId = `sp-${id}`;
  return `
  <div class="chart-outer">
    <h3>Day at a Glance</h3>
    <div class="chart-wrap">
      <div class="chart-canvas-col"><canvas id="${id}"></canvas></div>
      <div id="${panelId}" class="staff-panel-col"></div>
    </div>
  </div>
  <script>
  (function(){
    const labels   = ${JSON.stringify(ts.labels)};
    const revenue  = ${JSON.stringify(ts.revenue)};
    const headcount= ${JSON.stringify(ts.headcount)};
    const labor    = ${JSON.stringify(ts.laborCost)};
    const staff    = ${JSON.stringify(ts.staff || [])};
    const panel    = document.getElementById('${panelId}');
    let lastIdx    = -1;

    function updatePanel(idx) {
      if (idx === lastIdx) return;
      lastIdx = idx;
      if (!panel) return;
      if (idx < 0) { panel.innerHTML = ''; return; }
      const names = staff[idx] || [];
      const panelH   = panel.clientHeight || 256;
      const labelH   = 26;
      const avail    = panelH - labelH - 8;
      const raw      = names.length > 0 ? Math.floor(avail / names.length / 1.45) : 13;
      const fs       = Math.min(13, Math.max(7, raw));
      panel.innerHTML = '<div class="sp-time">' + labels[idx] + '</div>'
        + names.map(n => '<div class="sp-name" style="font-size:' + fs + 'px;padding:' + Math.max(1, fs * 0.12) + 'px 0">· ' + n + '</div>').join('');
    }

    new Chart(document.getElementById('${id}'), {
      data: {
        labels,
        datasets: [
          { type:'bar',  label:'Revenue ($)',    data:revenue,   backgroundColor:'rgba(201,168,76,0.45)', borderColor:'#C9A84C', borderWidth:1, yAxisID:'yRev', order:3 },
          { type:'line', label:'Staff on floor', data:headcount, borderColor:'#4ECDC4', backgroundColor:'rgba(78,205,196,0.08)', tension:0.4, pointRadius:2, yAxisID:'yPpl', order:1 },
          { type:'line', label:'Labor cost ($)', data:labor,     borderColor:'#FF6B6B', backgroundColor:'rgba(255,107,107,0.05)', tension:0.4, pointRadius:2, borderDash:[4,2], yAxisID:'yRev', order:2 },
        ]
      },
      options: {
        responsive:true,
        onHover: (evt, activeEls) => updatePanel(activeEls.length ? activeEls[0].index : -1),
        interaction:{ mode:'index', intersect:false },
        scales:{
          x:{ ticks:{ color:'#555', maxRotation:45, font:{size:10} }, grid:{ color:'#1A1A24' } },
          yRev:{ position:'left',  ticks:{ color:'#C9A84C', callback:v=>'$'+v }, grid:{ color:'#1A1A24' } },
          yPpl:{ position:'right', ticks:{ color:'#4ECDC4', stepSize:1, callback:v=>v+'ppl' }, grid:{ display:false } },
        },
        plugins:{
          legend:{ labels:{ color:'#888', boxWidth:12, font:{size:11} } },
          tooltip:{ backgroundColor:'#13131A', borderColor:'#2A2A3A', borderWidth:1, titleColor:'#fff', bodyColor:'#ccc',
            callbacks:{ label: ctx => {
              if(ctx.dataset.label.startsWith('Staff')) return ' '+ctx.parsed.y+' people';
              return ' $'+ctx.parsed.y.toFixed(2);
            }}
          },
        }
      }
    });
  })();
  </script>`;
}

function weatherStrip(weather) {
  if (!weather?.hourly?.length) return '';
  const cols = weather.hourly;
  const hours = cols.map(c => `<th title="${c.desc} ${c.tempF}°F">${c.label}</th>`).join('');
  const icons = cols.map(c => `<td title="${c.desc} ${c.tempF}°F">${c.emoji}</td>`).join('');
  return `<div class="weather-strip">
    <table class="weather-table"><thead><tr>${hours}</tr></thead><tbody><tr>${icons}</tr></tbody></table>
  </div>`;
}

function locationSection(loc, weather) {
  const s = loc.sales;
  const l = loc.labor;
  return `
  <div class="location-block">
    <h2 class="loc-name">${loc.name}</h2>

    ${alertsBlock(l)}

    ${chartSection(loc.timeSeries)}

    ${weatherStrip(weather)}

    ${metricsGrid([
      ['Gross Sales', $(s.grossSales)],
      ['Net Sales', $(s.netSales)],
      ['Orders', num(s.orderCount)],
      ['Avg Check', $(s.avgCheck)],
      ['Tips', $(s.tipTotal)],
      ['Hours Worked', `${l.totalHours}h`],
    ])}

    <h3>Top Sellers</h3>
    ${topItemsTable(s.topItems)}

    <h3>Discounts</h3>
    ${discountsSection(s.discounts)}

    ${(v => v ? `<h3>Voids</h3>${v}` : '')(voidsSection(loc.voids))}
  </div>`;
}

export function render({ locations, totals, eightySixedItems = [], retailLocations = [] }, displayDate, weather = null) {
  const multi = locations.length > 1;
  const ts = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
  const reportDay  = new Date(displayDate + 'T12:00:00');
  const dayName    = reportDay.toLocaleDateString('en-US', { weekday: 'long' });
  const isWeekend  = reportDay.getDay() === 0 || reportDay.getDay() === 6;

  const combinedBanner = multi ? `
  <div class="totals-banner">
    <div class="banner-label">All Locations Combined</div>
    ${metricsGrid([
      ['Gross Sales', $(totals.grossSales)],
      ['Net Sales', $(totals.netSales)],
      ['Orders', num(totals.orderCount)],
      ['Avg Check', $(totals.avgCheck)],
      ['Tips', $(totals.tipTotal)],
      ['Total Hours', `${totals.totalHours}h`],
    ])}
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<title>Jeannine's Daily Report — ${displayDate}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Inter',sans-serif;background:#0A0A0F;color:#fff;padding:2rem 1rem;min-height:100vh}
.wrap{max-width:900px;margin:0 auto}

/* Header */
.rpt-header{border-bottom:2px solid #C9A84C;padding-bottom:1.5rem;margin-bottom:2rem;display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}
.rpt-left{flex:1}
.rpt-title{font-size:2rem;font-weight:800;color:#C9A84C;letter-spacing:-0.5px}
.rpt-date{font-size:1rem;color:#999;margin-top:.25rem}
.rpt-ts{font-size:.7rem;color:#444;margin-top:.4rem}
.day-badge{flex-shrink:0;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:.35rem .85rem;border-radius:9999px;margin-top:.25rem}
.day-badge.weekend{color:#F0B429;background:rgba(240,180,41,.1);border:1px solid rgba(240,180,41,.25)}
.day-badge.weekday{color:#555;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}

/* Totals banner */
.totals-banner{background:#13131A;border:1px solid rgba(201,168,76,.2);border-radius:4px;padding:1.5rem;margin-bottom:2rem}
.banner-label{font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:#C9A84C;margin-bottom:1rem}

/* Weather strip */
.weather-strip{background:#13131A;border-radius:8px;padding:.75rem 1rem;margin-bottom:1.25rem}
.weather-table{width:100%;border-collapse:collapse;text-align:center}
.weather-table th{color:#AAAAAA;font-size:.75rem;font-weight:700;padding:.4rem .2rem;white-space:nowrap}
.weather-table td{font-size:1.4rem;padding:.2rem .2rem .5rem;line-height:1.2;cursor:default}

/* Metric grid */
.metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin-bottom:1.75rem}
.metric-card{background:#0A0A0F;border-radius:4px;padding:.875rem;text-align:center;border:1px solid #1A1A24}
.metric-label{font-size:.65rem;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.4rem}
.metric-value{font-size:1.2rem;font-weight:700}

/* Location block */
.location-block{background:#13131A;border-radius:4px;padding:1.5rem;margin-bottom:1.75rem}
.loc-name{font-size:1.15rem;font-weight:700;color:#C9A84C;margin-bottom:1.25rem;padding-bottom:.75rem;border-bottom:1px solid rgba(201,168,76,.15)}

h3{font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:#666;margin:1.5rem 0 .75rem}
h3.ot-heading{color:#F0B429}

/* Tables */
.data-table{width:100%;border-collapse:collapse;font-size:.875rem}
.data-table th{text-align:left;padding:.55rem .75rem;font-size:.65rem;text-transform:uppercase;letter-spacing:.5px;color:#666;border-bottom:1px solid #2A2A3A}
.data-table td{padding:.55rem .75rem;color:#e0e0e0}
.data-table tr.even td{background:#0D0D14}

.ot{color:#F0B429;font-weight:600}
.dt{color:#FF6B6B;font-weight:700}
.missed{color:#FF6B6B;font-weight:600}
.ot-pill{display:inline-block;padding:.15rem .5rem;border-radius:3px;font-size:.85rem;font-weight:700;vertical-align:middle}
.ot .ot-pill{background:rgba(240,180,41,.15)}
.dt .ot-pill{background:rgba(255,107,107,.15)}
.wage-tag{font-size:.7rem;color:#666;margin-left:.4rem;font-weight:400}
.extra-cost{font-size:.8rem;color:#FF6B6B;font-weight:600;margin-left:.5rem}

/* Alert cards */
.alert-card{border-radius:4px;padding:1.25rem;margin-bottom:1rem}
.ot-card{background:rgba(240,180,41,.07);border:1px solid rgba(240,180,41,.3)}
.break-card{background:rgba(255,107,107,.07);border:1px solid rgba(255,107,107,.35)}
.alert-title{font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.875rem}
.ot-card .alert-title{color:#F0B429}
.break-card .alert-title{color:#FF6B6B}
.legal-note{font-size:.7rem;font-weight:400;color:#999;text-transform:none;letter-spacing:0}
.all-clear{font-size:.8rem;color:#4CAF50;padding:.75rem 0 1.25rem;letter-spacing:.3px}

.ok{font-size:.875rem;color:#4CAF50;padding:.25rem 0}
.empty{font-size:.875rem;color:#555;padding:.25rem 0}

/* Chart */
.chart-outer{margin-bottom:1.75rem}
.chart-wrap{background:#0A0A0F;border:1px solid #1A1A24;border-radius:4px;overflow:hidden;height:280px;display:flex;padding:0}
.chart-canvas-col{flex:1;min-width:0;padding:1rem;position:relative;height:280px}
.chart-canvas-col canvas{max-height:248px}
.staff-panel-col{width:180px;flex-shrink:0;border-left:1px solid #1A1A24;padding:.75rem;overflow:hidden;display:flex;flex-direction:column;background:#0A0A0F}
.sp-time{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#4ECDC4;padding-bottom:.35rem;margin-bottom:.4rem;border-bottom:1px solid #1A1A24}
.sp-name{font-size:.78rem;color:#ccc;padding:.18rem 0;line-height:1.3}

/* Sort toolbar */
.table-toolbar{display:flex;align-items:center;gap:.5rem;margin-bottom:.6rem}
.sort-label{font-size:.7rem;color:#555;text-transform:uppercase;letter-spacing:.5px}
.sort-btn{background:#1A1A24;border:1px solid #2A2A3A;color:#666;font-size:.75rem;padding:.3rem .75rem;border-radius:3px;cursor:pointer;transition:all .15s}
.sort-btn:hover{border-color:#C9A84C;color:#C9A84C}
.sort-btn.active{background:rgba(201,168,76,.12);border-color:#C9A84C;color:#C9A84C;font-weight:600}
.cross-highlight td{background:rgba(78,205,196,.07)!important;border-left:2px solid #4ECDC4}
.cross-tag{font-size:.65rem;color:#4ECDC4;background:rgba(78,205,196,.12);border:1px solid rgba(78,205,196,.3);padding:.1rem .35rem;border-radius:2px;margin-left:.4rem;vertical-align:middle;font-weight:600;text-transform:uppercase;letter-spacing:.3px}

/* Retail totals */
.retail-totals{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.25rem}
.rt-card{background:#0A0A0F;border:1px solid rgba(78,205,196,.12);border-radius:4px;padding:.75rem;text-align:center}
.rt-total{border-color:rgba(78,205,196,.35)}
.rt-label{font-size:.6rem;text-transform:uppercase;letter-spacing:.5px;color:#666;margin-bottom:.3rem}
.rt-value{font-size:1.1rem;font-weight:700;color:#4ECDC4}
.rt-sub{font-size:.7rem;color:#555;margin-top:.2rem}

/* Retail controls */
.retail-controls{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap}
.retail-toggle{display:flex;align-items:center;gap:.375rem;flex-wrap:wrap}
.rtgl-btn{background:transparent;border:1px solid rgba(78,205,196,.25);color:#4ECDC4;font-size:.75rem;padding:.3rem .85rem;border-radius:9999px;cursor:pointer;transition:all .15s;font-weight:500}
.rtgl-btn:hover,.rtgl-btn.active{background:rgba(78,205,196,.1);border-color:#4ECDC4}
.retail-sort-inline{display:flex;align-items:center;gap:.5rem}
.retail-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}
@media(max-width:700px){.retail-grid{grid-template-columns:1fr}}

/* Day navigation */
.day-nav{display:flex;align-items:center;gap:.375rem;margin-top:1.1rem}
.nav-btn{background:transparent;border:1px solid rgba(201,168,76,.25);color:#C9A84C;font-size:.75rem;padding:.3rem .85rem;border-radius:9999px;cursor:pointer;transition:all .15s;font-weight:500;letter-spacing:.2px}
.nav-btn:hover{background:rgba(201,168,76,.1);border-color:#C9A84C}
.nav-date{background:transparent;border:1px solid rgba(201,168,76,.25);color:#888;font-size:.75rem;padding:.3rem .65rem;border-radius:9999px;cursor:pointer;outline:none;color-scheme:dark;transition:all .15s}
.nav-date:hover,.nav-date:focus{border-color:#C9A84C;color:#e0e0e0}

/* Footer */
footer{text-align:center;color:#2A2A2A;font-size:.7rem;margin-top:2rem;padding-top:2rem;border-top:1px solid #1A1A24}

@media(max-width:600px){
  .metrics-grid{grid-template-columns:repeat(2,1fr)}
  .rpt-title{font-size:1.5rem}
}
</style>
</head>
<body>
<div class="wrap">

  <div class="rpt-header">
    <div class="rpt-left">
      <div class="rpt-title">Jeannine's Daily Report</div>
      <div class="rpt-date">${displayDate}</div>
      <div class="rpt-ts">Generated ${ts} PT</div>
      <div class="day-nav">
      <button class="nav-btn" onclick="goDay(-1)">← Prev</button>
      <input type="date" class="nav-date" value="${displayDate}" onchange="goToDate(this.value)">
      <button class="nav-btn" onclick="goDay(1)">Next →</button>
    </div>
    </div>
    <div class="day-badge ${isWeekend ? 'weekend' : 'weekday'}">${dayName}</div>
  </div>

  ${combinedBanner}
  ${eightySixedItems.length ? `
  <div class="location-block">
    <h2 class="loc-name" style="color:#F0B429">Currently 86'd</h2>
    ${eightySixSection(eightySixedItems)}
  </div>` : ''}
  ${locations.map(loc => locationSection(loc, weather)).join('\n')}
  ${retailTopItemsSection(retailLocations)}

  <footer>Jeannine's Restaurant &amp; Bakery · Santa Barbara, CA · Powered by Toast POS</footer>
</div>
<script>
function setRetailView(view) {
  const cols     = document.getElementById('retail-cols');
  const allView  = document.getElementById('retail-all-view');
  const foodCol  = document.getElementById('retail-col-food');
  const nonfoodCol = document.getElementById('retail-col-nonfood');
  const sortBar  = document.getElementById('retail-sort-bar');
  if (!cols) return;
  cols.style.display     = view === 'all' ? 'none' : '';
  if (allView)   allView.style.display   = view === 'all'     ? ''     : 'none';
  if (foodCol)   foodCol.style.display   = view === 'nonfood' ? 'none' : '';
  if (nonfoodCol) nonfoodCol.style.display = view === 'food'  ? 'none' : '';
  if (sortBar)   sortBar.style.display   = view === 'all'     ? ''     : 'none';
  document.querySelectorAll('.rtgl-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view)
  );
}
const _reportDate = '${displayDate}';
function goDay(delta) {
  const d = new Date(_reportDate + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  window.location.href = '/api/report?date=' + y + '-' + m + '-' + day;
}
function goToDate(val) {
  if (val) window.location.href = '/api/report?date=' + val;
}
function sortItems(id, by) {
  const table = document.getElementById(id);
  if (!table) return;
  const all = window[id];
  const data = [...all].sort((a, b) => by === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty);
  const fmt  = n => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Rank each item in the OTHER dimension (1 = best)
  const otherBy = by === 'qty' ? 'revenue' : 'qty';
  const otherLabel = by === 'qty' ? 'rev' : 'qty';
  const ranked = [...all].sort((a, b) => b[otherBy] - a[otherBy]);
  const rankMap = {};
  ranked.forEach((item, i) => { if (i < 5) rankMap[item.name] = i + 1; });

  // Gradient: rank 1 most vivid → rank 5 faintest
  const bgOpacity   = [0, 0.22, 0.15, 0.10, 0.06, 0.03];
  const bdrOpacity  = [0, 1.00, 0.72, 0.50, 0.32, 0.18];
  const tagOpacity  = [0, 1.00, 0.80, 0.62, 0.45, 0.30];

  const hasType = all.some(it => it.category);
  function cpill(cat) {
    if (!cat) return '';
    const lower = cat.toLowerCase();
    const color = lower.includes('non-food') || lower.includes('nonfood') ? '#C9A84C'
                : lower.includes('food') ? '#4ECDC4' : '#666';
    const bg = lower.includes('non-food') || lower.includes('nonfood') ? 'rgba(201,168,76,.12)'
             : lower.includes('food') ? 'rgba(78,205,196,.12)' : 'rgba(255,255,255,.06)';
    const label = cat.replace(/^Retail\s+/i, '');
    return \`<span style="display:inline-block;font-size:.65rem;font-weight:600;padding:.2rem .55rem;border-radius:4px;color:\${color};background:\${bg};border:1px solid \${color}33;white-space:nowrap">\${label}</span>\`;
  }
  table.querySelector('tbody').innerHTML = data.map((item, i) => {
    const rank = rankMap[item.name];
    const bg   = rank ? \`rgba(78,205,196,\${bgOpacity[rank]})\`  : '';
    const bdr  = rank ? \`2px solid rgba(78,205,196,\${bdrOpacity[rank]})\` : '';
    const rowStyle = rank ? \`background:\${bg}!important;border-left:\${bdr}\` : '';
    const tag  = rank
      ? \`<span class="cross-tag" style="opacity:\${tagOpacity[rank]}">#\${rank} \${otherLabel}</span>\`
      : '';
    return \`<tr style="\${rowStyle}">
      <td>\${i + 1}</td>
      <td>\${item.name} \${tag}</td>
      \${hasType ? \`<td>\${cpill(item.category)}</td>\` : ''}
      <td>\${item.qty}</td>
      <td>\${fmt(item.revenue)}</td>
    </tr>\`;
  }).join('');

  const toolbar = table.previousElementSibling;
  toolbar.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().startsWith(by === 'qty' ? 'q' : 'r'));
  });
}
function sortRetailAll(id, by) {
  const table = document.getElementById(id);
  if (!table) return;
  const all  = window[id];
  const data = [...all].sort((a, b) => by === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty);
  const fmt  = n => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const badge = cat => {
    const isFd  = cat === 'Food';
    const color = isFd ? '#4ECDC4' : '#C9A84C';
    const bg    = isFd ? 'rgba(78,205,196,.1)'  : 'rgba(201,168,76,.1)';
    const bdr   = isFd ? 'rgba(78,205,196,.25)' : 'rgba(201,168,76,.25)';
    return \`<span style="font-size:.65rem;font-weight:600;color:\${color};background:\${bg};border:1px solid \${bdr};padding:.1rem .4rem;border-radius:3px;white-space:nowrap">\${cat}</span>\`;
  };
  table.querySelector('tbody').innerHTML = data.map((item, i) => \`
    <tr class="\${i % 2 === 0 ? 'even' : ''}">
      <td>\${i + 1}</td>
      <td>\${item.name}</td>
      <td>\${badge(item.category)}</td>
      <td>\${item.qty}</td>
      <td>\${fmt(item.revenue)}</td>
    </tr>\`).join('');
  const sortBar = document.getElementById('retail-sort-bar');
  if (sortBar) sortBar.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().startsWith(by === 'qty' ? 'q' : 'r'));
  });
}
</script>
</body>
</html>`;
}
