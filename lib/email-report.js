function fmt$(n) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function dayOfWeek(isoDate) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(isoDate + 'T12:00:00Z').getUTCDay()];
}

function metricRow(label1, value1, label2, value2) {
  return `<tr>
    <td width="50%" valign="top" style="padding:5px 5px 5px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:8px;">
        <tr><td style="padding:22px 20px;">
          <div style="color:#888888;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">${label1}</div>
          <div style="color:#FFFFFF;font-size:32px;font-weight:700;">${value1}</div>
        </td></tr>
      </table>
    </td>
    <td width="50%" valign="top" style="padding:5px 0 5px 5px;">
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:8px;">
        <tr><td style="padding:22px 20px;">
          <div style="color:#888888;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">${label2}</div>
          <div style="color:#FFFFFF;font-size:32px;font-weight:700;">${value2}</div>
        </td></tr>
      </table>
    </td>
  </tr>`;
}

function metricRowFull(label, value) {
  return `<tr>
    <td colspan="2" style="padding:5px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:8px;">
        <tr><td style="padding:22px 20px;">
          <div style="color:#888888;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">${label}</div>
          <div style="color:#FFFFFF;font-size:32px;font-weight:700;">${value}</div>
        </td></tr>
      </table>
    </td>
  </tr>`;
}

function sectionTitle(text, color = '#C9A84C') {
  return `<div style="color:${color};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:22px;">${text}</div>`;
}

function pillButton(url, label = 'View Full Report →') {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td align="center" bgcolor="#C9A84C" style="background-color:#C9A84C;border-radius:999px;padding:16px 40px;">
        <a href="${url}" style="color:#0A0A0F;font-size:18px;font-weight:700;text-decoration:none;display:block;white-space:nowrap;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function eventBanner(events) {
  const all = [
    ...(events.national || []).map(e => `✦ ${e}`),
    ...(events.local || []).map(e => `✦ ${e}`),
  ];
  if (!all.length) return '';
  const lines = all.map(e =>
    `<div style="color:#F0D878;font-size:13px;font-weight:600;line-height:1.6;">${e}</div>`
  ).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#1C1600" style="background-color:#1C1600;border-radius:6px;border:1px solid #C9A84C;">
    <tr><td style="padding:10px 14px;">
      <div style="color:#C9A84C;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Today in Santa Barbara</div>
      ${lines}
    </td></tr>
  </table>`;
}

// Accent color per location GUID — keeps dark backgrounds, just swaps the highlight color
const LOCATION_COLOR = {
  'bac64c98-94fa-43f8-928d-c4ef94e68e78': '#E8832A',  // At the Shore — orange
  '9876a700-dac3-4b89-b92d-ffb9ac247eee': '#64BAE4',  // Montecito — baby blue
  '87077240-4861-466d-9245-eedefdc6a862': '#E05555',  // Goleta — red
};

const LOCATION_MANAGERS = {
  'bac64c98-94fa-43f8-928d-c4ef94e68e78': 'Cesar & Alex',
  '9876a700-dac3-4b89-b92d-ffb9ac247eee': 'Ruth, Nikolas & Alex',
  '87077240-4861-466d-9245-eedefdc6a862': 'Nikolas & Alex',
};

export function generateEmailHtml(data, displayDate, reportUrl, chartUrls = null, weather = null, linkToken = null, events = null) {
  const { locations, retailLocations } = data;
  const multi = locations.length > 1;

  const dow = dayOfWeek(displayDate);
  const isWeekend = dow === 'Saturday' || dow === 'Sunday';
  const badgeColor = isWeekend ? '#C9A84C' : '#888888';
  const badgeBg    = isWeekend ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.06)';
  const revAlphas  = [0.22, 0.16, 0.12, 0.08, 0.05];

  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const secureReportUrl = linkToken ? `${reportUrl}?t=${encodeURIComponent(linkToken)}` : reportUrl;

  // Combined net + orders across all locations
  const combinedNet    = locations.reduce((s, l) => s + l.sales.netSales, 0);
  const combinedOrders = locations.reduce((s, l) => s + l.sales.orderCount, 0);

  // Aggregate retail across all locations, merging duplicate item names
  let foodRevenue = 0, foodQty = 0, nonfoodRevenue = 0, nonfoodQty = 0;
  const allRetailItems = [];
  for (const ret of (retailLocations || [])) {
    for (const [cat, d] of Object.entries(ret?.topItemsByCategory || {})) {
      const isFood = cat.toLowerCase().includes('food') && !cat.toLowerCase().includes('non');
      if (isFood) { foodRevenue += d.totalRevenue; foodQty += d.totalQty; }
      else { nonfoodRevenue += d.totalRevenue; nonfoodQty += d.totalQty; }
      for (const item of d.items) {
        const ex = allRetailItems.find(i => i.name === item.name);
        if (ex) { ex.qty += item.qty; ex.revenue += item.revenue; }
        else allRetailItems.push({ ...item, category: cat });
      }
    }
  }
  allRetailItems.sort((a, b) => b.qty - a.qty);
  const totalRetailRevenue = foodRevenue + nonfoodRevenue;
  const totalRetailQty     = foodQty + nonfoodQty;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Today's Report — Jeannine's</title>
<style type="text/css">
  :root { color-scheme: dark; }
  @media (prefers-color-scheme: light) {
    body, table, td { background-color: #0A0A0F !important; color: #FFFFFF !important; }
  }
</style>
</head>
<body bgcolor="#0A0A0F" style="margin:0;padding:0;background-color:#0A0A0F;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0A0A0F" style="background-color:#0A0A0F;">
<tr><td align="center" style="padding:20px 0 40px;">
<table cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- HEADER -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:28px 28px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td valign="top">
        <div style="font-size:28px;font-weight:700;color:#C9A84C;margin-bottom:6px;">Today's Report</div>
        <div style="font-size:16px;color:#FFFFFF;margin-bottom:3px;">${displayDate}</div>
        <div style="font-size:12px;color:#555555;">Generated ${now} PT</div>
      </td>
      <td align="right" valign="top" style="padding-left:12px;">
        <span style="display:inline-block;font-size:11px;font-weight:700;padding:4px 12px;border-radius:4px;color:${badgeColor};background-color:${badgeBg};border:1px solid ${badgeColor}44;">${dow.toUpperCase()}</span>
        ${events && (events.national.length || events.local.length) ? [...(events.national||[]), ...(events.local||[])].slice(0, 2).map(e => `<div style="color:#C9A84C;font-size:11px;font-weight:600;margin-top:6px;text-align:right;line-height:1.4;">✦ ${e}</div>`).join('') : ''}
      </td>
    </tr>
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;

  // LOCATION SUMMARY — 3 columns, one per location
  if (multi) {
    const colW = Math.round(100 / locations.length) + '%';
    html += `
<!-- LOCATION SUMMARY -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:20px 16px 16px;">
  <div style="color:#888888;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;margin-bottom:14px;">All Locations — Net Sales</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>`;
    locations.forEach((loc, i) => {
      const padL = i === 0 ? '0' : '4px';
      const padR = i === locations.length - 1 ? '0' : '4px';
      const locCol = LOCATION_COLOR[loc.guid] || '#C9A84C';
      const retailNet = retailLocations?.[i]?.sales?.netSales ?? 0;
      const otCount = loc.labor?.overtime?.length ?? 0;
      const mbCount = loc.labor?.missedBreakCount ?? 0;
      html += `
      <td width="${colW}" valign="top" style="padding:0 ${padR} 0 ${padL};">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0A0A0F" style="background-color:#0A0A0F;border-radius:6px;border-top:2px solid ${locCol};">
          <tr><td align="center" style="padding:14px 6px 12px;">
            <div style="color:#666666;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">${loc.name.toUpperCase()}</div>
            <div style="color:${locCol};font-size:22px;font-weight:700;">${fmt$(loc.sales.netSales)}</div>
            <div style="color:#888888;font-size:13px;margin-top:5px;">${loc.sales.orderCount.toLocaleString()} orders</div>
            <div style="color:#666666;font-size:12px;margin-top:3px;">avg <span style="color:${locCol};font-weight:700;">${fmt$(loc.sales.avgCheck)}</span></div>
            ${retailNet > 0 ? `<div style="font-size:11px;margin-top:8px;padding-top:8px;border-top:1px solid #1a1a1a;"><span style="color:#666666;">Retail </span><span style="color:${locCol};font-weight:700;font-size:13px;">${fmt$(retailNet)}</span></div>` : ''}
            ${(otCount > 0 || mbCount > 0) ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid #1a1a1a;padding-top:8px;">
              <tr>
                <td style="text-align:center;padding-top:6px;padding-left:8px;">
                  <div style="color:${locCol};font-size:17px;font-weight:700;">${otCount}</div>
                  <div style="color:#555555;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:2px;">OT</div>
                </td>
                <td style="text-align:center;padding-top:6px;padding-right:8px;">
                  <div style="color:${locCol};font-size:17px;font-weight:700;">${mbCount}</div>
                  <div style="color:#555555;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:2px;">Missed Breaks</div>
                </td>
              </tr>
            </table>` : ''}
          </td></tr>
        </table>
      </td>`;
    });
    html += `
    </tr>
  </table>
  <div style="margin-top:14px;padding-top:12px;border-top:1px solid #222222;text-align:center;">
    <span style="color:#555555;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-right:12px;">Combined Net</span>
    <span style="color:#FFFFFF;font-size:18px;font-weight:700;">${fmt$(combinedNet)}</span>
    <span style="color:#555555;font-size:12px;margin-left:12px;">${combinedOrders.toLocaleString()} orders</span>
  </div>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
  }

  // PER-LOCATION SECTIONS
  for (let li = 0; li < locations.length; li++) {
    const loc = locations[li];
    const { sales, labor, timeSeries: ts, voids } = loc;
    const hasOT = labor.otCount > 0;
    const hasMB = labor.missedBreakCount > 0;
    const locColor = LOCATION_COLOR[loc.guid] || '#C9A84C';

    // Location name divider
    if (multi) {
      if (li > 0) html += `
<tr><td style="padding:28px 0 0;">
  <div style="height:2px;background:linear-gradient(90deg,transparent,${locColor},transparent);border-radius:1px;"></div>
</td></tr>`;
      if (events && (events.national.length || events.local.length)) {
        html += `<tr><td style="padding:0 0 8px;">${eventBanner(events)}</td></tr>`;
      }
      html += `
<!-- ${loc.name.toUpperCase()} -->
<tr><td style="padding-top:${li === 0 ? '0' : '16px'};padding-bottom:14px;padding-left:14px;border-left:4px solid ${locColor};">
  <div>
    <span style="display:inline-block;color:${locColor};font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid ${locColor}44;padding:6px 22px;border-radius:4px;">${loc.name}</span>
    ${LOCATION_MANAGERS[loc.guid] ? `<div style="color:#555555;font-size:12px;margin-top:6px;">${LOCATION_MANAGERS[loc.guid]}</div>` : ''}
  </div>
</td></tr>`;
    }


    // ALERTS
    if (hasOT || hasMB) {
      html += `
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>`;
      if (hasOT) html += `
      <td valign="top" style="padding-right:${hasMB ? '5px' : '0'};">
        <table width="100%" cellpadding="14" cellspacing="0" bgcolor="#1e1010" style="background-color:#1e1010;border-radius:6px;border-left:3px solid #FF6B6B;">
          <tr><td>
            <div style="color:#FF6B6B;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">OVERTIME</div>
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;">${labor.otCount} overtime</div>
          </td></tr>
        </table>
      </td>`;
      if (hasMB) html += `
      <td valign="top" style="padding-left:${hasOT ? '5px' : '0'};">
        <table width="100%" cellpadding="14" cellspacing="0" bgcolor="#1e1a0a" style="background-color:#1e1a0a;border-radius:6px;border-left:3px solid ${locColor};">
          <tr><td>
            <div style="color:${locColor};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">MISSED BREAKS</div>
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;">${labor.missedBreakCount} missed breaks</div>
          </td></tr>
        </table>
      </td>`;
      html += `
    </tr>
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }

    // OT TABLE
    if (labor.overtime?.length) {
      const fmtOT = h => h >= 1 ? `+${h}h` : `+${Math.round(h * 60)}min`;
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:24px 22px 18px;">
  <div style="color:${locColor};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:4px;">Overtime &mdash; ${labor.otCount} Employee${labor.otCount !== 1 ? 's' : ''}</div>
  <div style="color:${locColor}99;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;margin-bottom:18px;">${loc.name}</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="55%" style="color:#555555;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #222222;">EMPLOYEE</td>
      <td align="right" width="20%" style="color:#555555;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #222222;">SHIFT</td>
      <td align="right" width="25%" style="color:${locColor};font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #222222;">OT</td>
    </tr>`;
      for (const emp of labor.overtime) {
        const dtBadge = emp.doubleTime ? ` <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;color:#FF6B6B;background-color:rgba(255,107,107,.12);border:1px solid rgba(255,107,107,.3);">2×</span>` : '';
        html += `
    <tr>
      <td style="padding:14px 8px 14px 0;border-bottom:1px solid #1a1a1a;"><div style="color:#FFFFFF;font-size:18px;font-weight:700;">${emp.name}${dtBadge}</div></td>
      <td align="right" style="color:#999999;font-size:18px;padding:14px 4px;border-bottom:1px solid #1a1a1a;white-space:nowrap;">${emp.hours}h</td>
      <td align="right" style="color:${locColor};font-size:18px;font-weight:700;padding:14px 0;border-bottom:1px solid #1a1a1a;white-space:nowrap;">${fmtOT(emp.otHours)}</td>
    </tr>`;
      }
      html += `
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }

    // MISSED BREAKS TABLE
    if (labor.missedBreaks?.length) {
      html += `
<tr><td bgcolor="#1e1a0a" style="background-color:#1e1a0a;border-radius:10px;padding:24px 22px 18px;border-left:3px solid ${locColor};">
  <div style="color:${locColor};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:4px;">Break Issues &mdash; ${labor.missedBreakCount} Employee${labor.missedBreakCount !== 1 ? 's' : ''}</div>
  <div style="color:${locColor}99;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;margin-bottom:18px;">${loc.name}</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="50%" style="color:#555555;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #2a2210;">EMPLOYEE</td>
      <td align="right" width="18%" style="color:#555555;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #2a2210;">SHIFT</td>
      <td align="right" width="32%" style="color:#555555;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #2a2210;">STATUS</td>
    </tr>`;
      for (const mb of labor.missedBreaks) {
        const statusColor = mb.noBreak ? '#FF6B6B' : locColor;
        const statusText  = mb.noBreak ? 'No break taken' : `Break at ${mb.breakHour}h`;
        html += `
    <tr>
      <td style="padding:13px 8px 13px 0;border-bottom:1px solid #1e1a08;">
        <div style="color:#FFFFFF;font-size:18px;font-weight:700;">${mb.name}</div>
        ${mb.waived ? `<div style="color:#555555;font-size:12px;margin-top:3px;">Waived</div>` : ''}
      </td>
      <td align="right" style="color:#999999;font-size:18px;padding:13px 4px;border-bottom:1px solid #1e1a08;white-space:nowrap;">${mb.hours}h</td>
      <td align="right" style="color:${statusColor};font-size:16px;font-weight:700;padding:13px 0;border-bottom:1px solid #1e1a08;white-space:nowrap;">${statusText}</td>
    </tr>`;
      }
      html += `
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }

    // WEATHER — per location
    const locWeather = loc.weather ?? (li === 0 ? weather : null);
    if (locWeather?.hourly?.length) {
      const cols = locWeather.hourly;
      const pct  = Math.round(100 / cols.length) + '%';
      html += `
<tr><td style="padding:0 0 10px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;">
    <tr><td colspan="${cols.length}" style="padding:12px 16px 4px;color:${locColor};font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Weather &mdash; ${locWeather.addr || '1 State St'}</td></tr>
    <tr>
      ${cols.map(c => `<td align="center" width="${pct}" style="padding:6px 2px 6px;color:#AAAAAA;font-size:13px;font-weight:700;">${c.label}</td>`).join('\n      ')}
    </tr>
    <tr>
      ${cols.map(c => `<td align="center" style="padding:2px 2px 14px;font-size:22px;line-height:1.2;" title="${c.desc} ${c.tempF}°F">${c.emoji}</td>`).join('\n      ')}
    </tr>
  </table>
</td></tr>
<tr><td style="height:10px;"></td></tr>`;
    }

    // METRICS
    const allStaffNames = new Set();
    (ts?.staff || []).forEach(slot => slot.forEach(name => allStaffNames.add(name)));
    const totalStaff = allStaffNames.size;
    const laborNote = `<span style="font-size:9px;font-weight:400;color:#888888;line-height:1.05;">Restaurant Staff<br>Restaurant Cleaning Staff<br>Bakery (9 people)<br>Maintenance Staff</span>`;
    html += `
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${metricRow('Net Sales', fmt$(sales.netSales), 'Staff Today', `${totalStaff} ${totalStaff === 1 ? 'person' : 'people'}`)}
    ${metricRow('Orders', sales.orderCount.toLocaleString(), 'Avg Check', fmt$(sales.avgCheck))}
    ${metricRow('Tips', fmt$(sales.tipTotal), 'Labor includes', laborNote)}
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;

    // DAY AT A GLANCE chart — one per location
    const locChartUrl = Array.isArray(chartUrls) ? (chartUrls[li] ?? null) : (li === 0 ? chartUrls : null);
    if (locChartUrl || ts?.revenue?.length) {
      let peakLine = '';
      if (ts?.revenue?.length) {
        const peakIdx = ts.revenue.indexOf(Math.max(...ts.revenue));
        peakLine = `Peak: <strong>${ts.labels[peakIdx]}</strong> &mdash; <strong>${fmt$(ts.revenue[peakIdx])}</strong> revenue, <strong>${ts.headcount[peakIdx]}</strong> staff on floor`;
      }
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:22px 20px 18px;">
  <div style="color:${locColor};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:${multi ? '4px' : '16px'};">Day at a Glance</div>`;
      if (multi) {
        html += `<div style="color:${locColor}99;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;margin-bottom:16px;">${loc.name}</div>`;
      }
      if (locChartUrl) {
        html += `<table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${locColor}55;border-radius:6px;"><tr><td style="padding:3px;line-height:0;">
          <img src="${locChartUrl}" width="502" alt="Day at a glance chart" style="display:block;max-width:100%;border-radius:4px;">
        </td></tr></table>`;
      } else {
        html += `<div style="color:#FFFFFF;font-size:16px;line-height:1.5;">${peakLine}</div>`;
      }
      const fa = ts?.firstArrival, ld = ts?.lastDeparture;
      if (fa || ld) {
        html += `<div style="margin-top:12px;display:table;width:100%;">`;
        if (fa) html += `<div style="display:table-cell;text-align:left;"><span style="color:#555555;font-size:11px;">First in </span><span style="color:#CCCCCC;font-size:11px;font-weight:700;">${fa.name ? fa.name + ' ' : ''}${fa.time}</span></div>`;
        if (ld) html += `<div style="display:table-cell;text-align:right;"><span style="color:#CCCCCC;font-size:11px;font-weight:700;">${ld.name ? ld.name + ' ' : ''}${ld.time}</span><span style="color:#555555;font-size:11px;"> last out</span></div>`;
        html += `</div>`;
      }
      html += `
  <div style="margin-top:8px;"><a href="${secureReportUrl}" style="color:${locColor};text-decoration:none;font-size:12px;font-weight:600;">Open interactive chart →</a></div>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }

    // TOP SELLERS (top 20 per location in email)
    if (sales.topItems?.length) {
      const topSellers = sales.topItems.slice(0, 20);
      const byRev = [...topSellers].sort((a, b) => b.revenue - a.revenue);
      const revRank = new Map(byRev.map((it, idx) => [it.name, idx]));
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:24px 22px 14px;">
  <div style="color:${locColor};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:4px;">Top Sellers</div>
  <div style="color:${locColor}99;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;margin-bottom:18px;">${loc.name}</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="5%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">#</td>
      <td width="65%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">ITEM</td>
      <td align="right" width="12%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">QTY</td>
      <td align="right" width="18%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">REVENUE</td>
    </tr>`;
      topSellers.forEach((item, i) => {
        const rvRank = revRank.get(item.name) ?? 99;
        const rowBg  = rvRank < 5 ? `background-color:rgba(201,168,76,${revAlphas[rvRank]});` : '';
        html += `
    <tr style="${rowBg}">
      <td style="color:#555555;font-size:18px;padding:13px 4px 13px 0;">${i + 1}</td>
      <td style="color:#FFFFFF;font-size:18px;padding:13px 8px 13px 0;">${item.name}</td>
      <td align="right" style="color:#FFFFFF;font-size:18px;padding:13px 4px;white-space:nowrap;">${item.qty}</td>
      <td align="right" style="color:${locColor};font-size:18px;padding:13px 0 13px 4px;white-space:nowrap;">${fmt$(item.revenue)}</td>
    </tr>`;
      });
      const tsShownQty = topSellers.reduce((s, i) => s + i.qty, 0);
      const tsShownRev = topSellers.reduce((s, i) => s + i.revenue, 0);
      const tsTotalQty = sales.totalItemQty ?? tsShownQty;
      const tsTotalRev = sales.totalItemRevenue ?? tsShownRev;
      html += `
    <tr>
      <td colspan="2" style="color:#888888;font-size:14px;font-weight:700;padding:12px 8px 8px 0;border-top:2px solid #333333;">TOTAL</td>
      <td align="right" style="color:#FFFFFF;font-size:14px;font-weight:700;padding:12px 4px 8px;border-top:2px solid #333333;white-space:nowrap;">${tsShownQty.toLocaleString()} / ${tsTotalQty.toLocaleString()}</td>
      <td align="right" style="color:${locColor};font-size:14px;font-weight:700;padding:12px 0 8px 4px;border-top:2px solid #333333;white-space:nowrap;">${fmt$(tsShownRev)} / ${fmt$(tsTotalRev)}</td>
    </tr>
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }

    // DISCOUNTS
    if (sales.discounts?.length) {
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:24px 22px 14px;">
  <div style="color:${locColor};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:4px;">Discounts &mdash; ${fmt$(sales.discountTotal)} total</div>
  <div style="color:${locColor}99;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;margin-bottom:18px;">${loc.name}</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">PROGRAM</td>
      <td align="right" width="50" style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">TIMES</td>
      <td align="right" width="90" style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">TOTAL</td>
    </tr>`;
      sales.discounts.forEach(d => {
        html += `
    <tr>
      <td style="color:#FFFFFF;font-size:14px;padding:8px 0;">${d.name}</td>
      <td align="right" style="color:#999999;font-size:14px;padding:8px 4px;">${d.count}</td>
      <td align="right" style="color:${locColor};font-size:14px;padding:8px 0;">${fmt$(d.total)}</td>
    </tr>`;
      });
      html += `
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }

    // RETAIL PER LOCATION
    const locRetail = retailLocations?.[li];
    const locRetailItems = [];
    for (const [, d] of Object.entries(locRetail?.topItemsByCategory || {})) {
      for (const item of d.items) {
        const ex = locRetailItems.find(i => i.name === item.name);
        if (ex) { ex.qty += item.qty; ex.revenue += item.revenue; }
        else locRetailItems.push({ ...item });
      }
    }
    locRetailItems.sort((a, b) => b.qty - a.qty);
    if (locRetailItems.length > 0) {
      const top20r = locRetailItems.slice(0, 20);
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:24px 22px 14px;">
  <div style="color:${locColor};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:4px;">Retail</div>
  <div style="color:${locColor}99;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;margin-bottom:18px;">${loc.name}</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="5%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">#</td>
      <td width="65%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">ITEM</td>
      <td align="right" width="12%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">QTY</td>
      <td align="right" width="18%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">REVENUE</td>
    </tr>`;
      const locRetailTotalQty = locRetailItems.reduce((s, i) => s + i.qty, 0);
      const locRetailTotalRev = locRetailItems.reduce((s, i) => s + i.revenue, 0);
      const top20rShownQty = top20r.reduce((s, i) => s + i.qty, 0);
      const top20rShownRev = top20r.reduce((s, i) => s + i.revenue, 0);
      top20r.forEach((item, i) => {
        html += `
    <tr>
      <td style="color:#555555;font-size:16px;padding:10px 4px 10px 0;">${i + 1}</td>
      <td style="color:#FFFFFF;font-size:16px;padding:10px 8px 10px 0;">${item.name}</td>
      <td align="right" style="color:#FFFFFF;font-size:16px;padding:10px 4px;white-space:nowrap;">${item.qty}</td>
      <td align="right" style="color:${locColor};font-size:16px;padding:10px 0 10px 4px;white-space:nowrap;">${fmt$(item.revenue)}</td>
    </tr>`;
      });
      html += `
    <tr style="border-top:2px solid #333333;">
      <td colspan="2" style="color:#888888;font-size:14px;font-weight:700;padding:12px 4px 8px 0;border-top:2px solid #333333;">TOTAL</td>
      <td align="right" style="color:#FFFFFF;font-size:14px;font-weight:700;padding:12px 4px 8px;border-top:2px solid #333333;white-space:nowrap;">${top20rShownQty} / ${locRetailTotalQty}</td>
      <td align="right" style="color:${locColor};font-size:14px;font-weight:700;padding:12px 0 8px 4px;border-top:2px solid #333333;white-space:nowrap;">${fmt$(top20rShownRev)} / ${fmt$(locRetailTotalRev)}</td>
    </tr>
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }

    // VOIDS
    if (voids?.count > 0 && voids?.totalAmount > 0) {
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:22px 24px;">
  <div style="color:#FF6B6B;font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:14px;">Voids</div>
  <div style="color:#FFFFFF;font-size:19px;text-align:center;">${voids.count} voided order${voids.count !== 1 ? 's' : ''} &nbsp;&middot;&nbsp; <span style="color:#FF6B6B;">${fmt$(voids.totalAmount)}</span> total</div>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }

  }

  // RETAIL — combined across all locations
  if (totalRetailRevenue > 0) {
    html += `
<!-- RETAIL SUMMARY -->
<tr><td style="padding-top:10px;">
  ${sectionTitle('Retail Top Sellers')}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="33%" valign="top" style="padding-right:5px;">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;border-top:2px solid #4ECDC4;">
          <tr><td align="center" style="padding:20px 8px;">
            <div style="color:#4ECDC4;font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:10px;">FOOD</div>
            <div style="color:#FFFFFF;font-size:24px;font-weight:700;">${fmt$(foodRevenue)}</div>
            <div style="color:#666666;font-size:14px;margin-top:6px;">${foodQty} items</div>
          </td></tr>
        </table>
      </td>
      <td width="33%" valign="top" style="padding:0 2px;">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;border-top:2px solid #C9A84C;">
          <tr><td align="center" style="padding:20px 8px;">
            <div style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:10px;">NON-FOOD</div>
            <div style="color:#FFFFFF;font-size:24px;font-weight:700;">${fmt$(nonfoodRevenue)}</div>
            <div style="color:#666666;font-size:14px;margin-top:6px;">${nonfoodQty} items</div>
          </td></tr>
        </table>
      </td>
      <td width="33%" valign="top" style="padding-left:5px;">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;border-top:2px solid #555555;">
          <tr><td align="center" style="padding:20px 8px;">
            <div style="color:#999999;font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:10px;">TOTAL</div>
            <div style="color:#FFFFFF;font-size:24px;font-weight:700;">${fmt$(totalRetailRevenue)}</div>
            <div style="color:#666666;font-size:14px;margin-top:6px;">${totalRetailQty} items</div>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;

    if (allRetailItems.length) {
      const retailTop15 = allRetailItems.slice(0, 20);
      const retailByRev = [...retailTop15].sort((a, b) => b.revenue - a.revenue);
      const retailRevRank = new Map(retailByRev.map((it, idx) => [it.name, idx]));
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:24px 22px 14px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="70%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">ITEM</td>
      <td align="right" width="12%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">QTY</td>
      <td align="right" width="18%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">REVENUE</td>
    </tr>`;
      const combinedRetailTotalQty = allRetailItems.reduce((s, i) => s + i.qty, 0);
      const combinedRetailTotalRev = allRetailItems.reduce((s, i) => s + i.revenue, 0);
      const retailShownQty = retailTop15.reduce((s, i) => s + i.qty, 0);
      const retailShownRev = retailTop15.reduce((s, i) => s + i.revenue, 0);
      retailTop15.forEach((item, i) => {
        const rvRank = retailRevRank.get(item.name) ?? 99;
        const rowBg  = rvRank < 5 ? `background-color:rgba(201,168,76,${revAlphas[rvRank]});` : '';
        html += `
    <tr style="${rowBg}">
      <td style="color:#FFFFFF;font-size:18px;padding:13px 8px 13px 0;">${item.name}</td>
      <td align="right" style="color:#FFFFFF;font-size:18px;padding:13px 4px;white-space:nowrap;">${item.qty}</td>
      <td align="right" style="color:#C9A84C;font-size:18px;padding:13px 0 13px 4px;white-space:nowrap;">${fmt$(item.revenue)}</td>
    </tr>`;
      });
      html += `
    <tr>
      <td style="color:#888888;font-size:14px;font-weight:700;padding:12px 8px 8px 0;border-top:2px solid #333333;">TOTAL</td>
      <td align="right" style="color:#FFFFFF;font-size:14px;font-weight:700;padding:12px 4px 8px;border-top:2px solid #333333;white-space:nowrap;">${retailShownQty.toLocaleString()} / ${combinedRetailTotalQty.toLocaleString()}</td>
      <td align="right" style="color:#C9A84C;font-size:14px;font-weight:700;padding:12px 0 8px 4px;border-top:2px solid #333333;white-space:nowrap;">${fmt$(retailShownRev)} / ${fmt$(combinedRetailTotalRev)}</td>
    </tr>
  </table>
  ${allRetailItems.length > 20 ? `<div style="text-align:center;padding:16px 0 4px;">
    <a href="${secureReportUrl}#retail-top-sellers" style="display:inline-block;color:#C9A84C;font-size:14px;font-weight:700;text-decoration:none;border:1px solid #C9A84C44;padding:10px 24px;border-radius:6px;">See all ${allRetailItems.length} items in full report →</a>
  </div>` : ''}
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }
  }

  // FOOTER
  html += `
<!-- FOOTER -->
<tr><td align="center" style="padding:20px 0 4px;">
  ${pillButton(secureReportUrl)}
  <div style="color:#333333;font-size:11px;margin-top:16px;">Jeannine's Restaurant &amp; Bakery &middot; Santa Barbara, CA</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { html };
}
