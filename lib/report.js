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
function topItemsTable(items) {
  if (!items.length) return '<p class="empty">No item data available.</p>';
  const id = `items-${tableId++}`;
  return `
    <div class="table-toolbar">
      <span class="sort-label">Sort by</span>
      <button class="sort-btn active" onclick="sortItems('${id}','qty')">Quantity</button>
      <button class="sort-btn" onclick="sortItems('${id}','revenue')">Revenue</button>
    </div>
    <table class="data-table" id="${id}">
      <thead><tr><th>#</th><th>Item</th><th class="col-qty">Qty</th><th>Revenue</th></tr></thead>
      <tbody></tbody>
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

let chartId = 0;
function chartSection(ts) {
  if (!ts) return '';
  const id = `chart-${chartId++}`;
  return `
  <div class="chart-outer">
    <h3>Day at a Glance</h3>
    <div class="chart-wrap"><canvas id="${id}"></canvas></div>
  </div>
  <script>
  (function(){
    const labels   = ${JSON.stringify(ts.labels)};
    const revenue  = ${JSON.stringify(ts.revenue)};
    const headcount= ${JSON.stringify(ts.headcount)};
    const labor    = ${JSON.stringify(ts.laborCost)};
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

function locationSection(loc) {
  const s = loc.sales;
  const l = loc.labor;
  return `
  <div class="location-block">
    <h2 class="loc-name">${loc.name}</h2>

    ${alertsBlock(l)}

    ${chartSection(loc.timeSeries)}

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

export function render({ locations, totals, eightySixedItems = [] }, displayDate) {
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
.chart-wrap{background:#0A0A0F;border:1px solid #1A1A24;border-radius:4px;padding:1rem;position:relative;height:280px}
.chart-wrap canvas{max-height:260px}

/* Sort toolbar */
.table-toolbar{display:flex;align-items:center;gap:.5rem;margin-bottom:.6rem}
.sort-label{font-size:.7rem;color:#555;text-transform:uppercase;letter-spacing:.5px}
.sort-btn{background:#1A1A24;border:1px solid #2A2A3A;color:#666;font-size:.75rem;padding:.3rem .75rem;border-radius:3px;cursor:pointer;transition:all .15s}
.sort-btn:hover{border-color:#C9A84C;color:#C9A84C}
.sort-btn.active{background:rgba(201,168,76,.12);border-color:#C9A84C;color:#C9A84C;font-weight:600}
.cross-highlight td{background:rgba(78,205,196,.07)!important;border-left:2px solid #4ECDC4}
.cross-tag{font-size:.65rem;color:#4ECDC4;background:rgba(78,205,196,.12);border:1px solid rgba(78,205,196,.3);padding:.1rem .35rem;border-radius:2px;margin-left:.4rem;vertical-align:middle;font-weight:600;text-transform:uppercase;letter-spacing:.3px}

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
  ${locations.map(locationSection).join('\n')}

  <footer>Jeannine's Restaurant &amp; Bakery · Santa Barbara, CA · Powered by Toast POS</footer>
</div>
<script>
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
      <td>\${item.qty}</td>
      <td>\${fmt(item.revenue)}</td>
    </tr>\`;
  }).join('');

  const toolbar = table.previousElementSibling;
  toolbar.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().startsWith(by === 'qty' ? 'q' : 'r'));
  });
}
</script>
</body>
</html>`;
}
