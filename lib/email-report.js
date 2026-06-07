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

export function generateEmailHtml(data, displayDate, reportUrl, chartUrl = null, weather = null, sitePassword = null) {
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
<title>Jeannine's Daily Report — ${displayDate}</title>
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
        <div style="font-size:28px;font-weight:700;color:#C9A84C;margin-bottom:6px;">Jeannine's Daily Report</div>
        <div style="font-size:16px;color:#FFFFFF;margin-bottom:3px;">${displayDate}</div>
        <div style="font-size:12px;color:#555555;">Generated ${now} PT</div>
      </td>
      <td align="right" valign="top" style="padding-left:12px;">
        <span style="display:inline-block;font-size:11px;font-weight:700;padding:4px 12px;border-radius:4px;color:${badgeColor};background-color:${badgeBg};border:1px solid ${badgeColor}44;">${dow.toUpperCase()}</span>
      </td>
    </tr>
    <tr><td colspan="2" align="center" style="padding-top:20px;">
      ${pillButton(reportUrl)}
      ${sitePassword ? `<div style="color:#666666;font-size:12px;margin-top:10px;">Password: <span style="color:#999999;font-weight:700;">${sitePassword}</span></div>` : ''}
    </td></tr>
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
      html += `
      <td width="${colW}" valign="top" style="padding:0 ${padR} 0 ${padL};">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0A0A0F" style="background-color:#0A0A0F;border-radius:6px;">
          <tr><td align="center" style="padding:14px 6px 12px;">
            <div style="color:#666666;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">${loc.name.toUpperCase()}</div>
            <div style="color:#C9A84C;font-size:22px;font-weight:700;">${fmt$(loc.sales.netSales)}</div>
            <div style="color:#888888;font-size:13px;margin-top:5px;">${loc.sales.orderCount.toLocaleString()} orders</div>
            <div style="color:#666666;font-size:12px;margin-top:3px;">avg ${fmt$(loc.sales.avgCheck)}</div>
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

    // Location name divider
    if (multi) {
      html += `
<!-- ${loc.name.toUpperCase()} -->
<tr><td style="padding:${li === 0 ? '0' : '20px'} 0 14px;">
  <div style="text-align:center;">
    <span style="display:inline-block;color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid #C9A84C44;padding:6px 22px;border-radius:4px;">${loc.name}</span>
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
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;">${labor.otCount} employees</div>
            <div style="color:#FF6B6B;font-size:13px;margin-top:3px;">${labor.otCount} employee${labor.otCount !== 1 ? 's' : ''} over 8h</div>
          </td></tr>
        </table>
      </td>`;
      if (hasMB) html += `
      <td valign="top" style="padding-left:${hasOT ? '5px' : '0'};">
        <table width="100%" cellpadding="14" cellspacing="0" bgcolor="#1e1a0a" style="background-color:#1e1a0a;border-radius:6px;border-left:3px solid #C9A84C;">
          <tr><td>
            <div style="color:#C9A84C;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">MISSED BREAKS</div>
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;">${labor.missedBreakCount} employees</div>
            <div style="color:#C9A84C;font-size:13px;margin-top:3px;">CA liability risk</div>
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
  <div style="color:#C9A84C;font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:22px;">Overtime &mdash; ${labor.otCount} Employee${labor.otCount !== 1 ? 's' : ''}</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="55%" style="color:#555555;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #222222;">EMPLOYEE</td>
      <td align="right" width="20%" style="color:#555555;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #222222;">SHIFT</td>
      <td align="right" width="25%" style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #222222;">OT</td>
    </tr>`;
      for (const emp of labor.overtime) {
        const dtBadge = emp.doubleTime ? ` <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;color:#FF6B6B;background-color:rgba(255,107,107,.12);border:1px solid rgba(255,107,107,.3);">2×</span>` : '';
        html += `
    <tr>
      <td style="padding:14px 8px 14px 0;border-bottom:1px solid #1a1a1a;"><div style="color:#FFFFFF;font-size:18px;font-weight:700;">${emp.name}${dtBadge}</div></td>
      <td align="right" style="color:#999999;font-size:18px;padding:14px 4px;border-bottom:1px solid #1a1a1a;white-space:nowrap;">${emp.hours}h</td>
      <td align="right" style="color:#C9A84C;font-size:18px;font-weight:700;padding:14px 0;border-bottom:1px solid #1a1a1a;white-space:nowrap;">${fmtOT(emp.otHours)}</td>
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
<tr><td bgcolor="#1e1a0a" style="background-color:#1e1a0a;border-radius:10px;padding:24px 22px 18px;border-left:3px solid #C9A84C;">
  <div style="color:#C9A84C;font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:22px;">Break Issues &mdash; ${labor.missedBreakCount} Employee${labor.missedBreakCount !== 1 ? 's' : ''}</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="50%" style="color:#555555;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #2a2210;">EMPLOYEE</td>
      <td align="right" width="18%" style="color:#555555;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #2a2210;">SHIFT</td>
      <td align="right" width="32%" style="color:#555555;font-size:13px;font-weight:700;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #2a2210;">STATUS</td>
    </tr>`;
      for (const mb of labor.missedBreaks) {
        const statusColor = mb.noBreak ? '#FF6B6B' : '#C9A84C';
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
    <tr><td colspan="${cols.length}" style="padding:12px 16px 4px;color:#555555;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Weather &mdash; ${locWeather.addr || '1 State St'}</td></tr>
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
    html += `
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${metricRow('Gross Sales', fmt$(sales.grossSales), 'Net Sales', fmt$(sales.netSales))}
    ${metricRow('Orders', sales.orderCount.toLocaleString(), 'Avg Check', fmt$(sales.avgCheck))}
    ${metricRow('Tips', fmt$(sales.tipTotal), 'Labor / Sales', (sales.netSales > 0 ? (labor.totalLaborCost / sales.netSales * 100).toFixed(1) : '0.0') + '%')}
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;

    // DAY AT A GLANCE chart — only for first location (chart is generated from location 0)
    if (li === 0 && (chartUrl || ts?.revenue?.length)) {
      let peakLine = '';
      if (ts?.revenue?.length) {
        const peakIdx = ts.revenue.indexOf(Math.max(...ts.revenue));
        peakLine = `Peak: <strong>${ts.labels[peakIdx]}</strong> &mdash; <strong>${fmt$(ts.revenue[peakIdx])}</strong> revenue, <strong>${ts.headcount[peakIdx]}</strong> staff on floor`;
      }
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:22px 20px 18px;">
  <div style="color:#888888;font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:16px;">Day at a Glance</div>`;
      if (chartUrl) {
        html += `<img src="${chartUrl}" width="508" alt="Day at a glance chart" style="display:block;max-width:100%;border-radius:4px;">`;
      } else {
        html += `<div style="color:#FFFFFF;font-size:16px;line-height:1.5;">${peakLine}</div>`;
      }
      html += `
  <div style="margin-top:8px;"><a href="${reportUrl}" style="color:#C9A84C;text-decoration:none;font-size:12px;font-weight:600;">Open interactive chart →</a></div>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }

    // TOP SELLERS (top 10 per location in email)
    if (sales.topItems?.length) {
      const top10 = sales.topItems.slice(0, 10);
      const byRev = [...top10].sort((a, b) => b.revenue - a.revenue);
      const revRank = new Map(byRev.map((it, idx) => [it.name, idx]));
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:24px 22px 14px;">
  ${sectionTitle('Top Sellers')}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="5%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">#</td>
      <td width="65%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">ITEM</td>
      <td align="right" width="12%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">QTY</td>
      <td align="right" width="18%" style="color:#444444;font-size:13px;font-weight:700;padding-bottom:12px;border-bottom:1px solid #222222;">REVENUE</td>
    </tr>`;
      top10.forEach((item, i) => {
        const rvRank = revRank.get(item.name) ?? 99;
        const rowBg  = rvRank < 5 ? `background-color:rgba(201,168,76,${revAlphas[rvRank]});` : '';
        html += `
    <tr style="${rowBg}">
      <td style="color:#555555;font-size:18px;padding:13px 4px 13px 0;">${i + 1}</td>
      <td style="color:#FFFFFF;font-size:18px;padding:13px 8px 13px 0;">${item.name}</td>
      <td align="right" style="color:#FFFFFF;font-size:18px;padding:13px 4px;white-space:nowrap;">${item.qty}</td>
      <td align="right" style="color:#C9A84C;font-size:18px;padding:13px 0 13px 4px;white-space:nowrap;">${fmt$(item.revenue)}</td>
    </tr>`;
      });
      html += `
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }

    // DISCOUNTS
    if (sales.discounts?.length) {
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:24px 22px 14px;">
  ${sectionTitle(`Discounts &mdash; ${fmt$(sales.discountTotal)} total`)}
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
      <td align="right" style="color:#C9A84C;font-size:14px;padding:8px 0;">${fmt$(d.total)}</td>
    </tr>`;
      });
      html += `
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
      const retailTop15 = allRetailItems.slice(0, 15);
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
      retailTop15.forEach(item => {
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
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }
  }

  // FOOTER
  html += `
<!-- FOOTER -->
<tr><td align="center" style="padding:20px 0 4px;">
  ${pillButton(reportUrl)}
  ${sitePassword ? `<div style="color:#666666;font-size:12px;margin-top:10px;">Password: <span style="color:#999999;font-weight:700;">${sitePassword}</span></div>` : ''}
  <div style="color:#333333;font-size:11px;margin-top:16px;">Jeannine's Restaurant &amp; Bakery &middot; Santa Barbara, CA</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { html };
}
