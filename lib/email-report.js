function offsetDate(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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
        <tr><td style="padding:20px 22px;">
          <div style="color:#888888;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">${label1}</div>
          <div style="color:#FFFFFF;font-size:26px;font-weight:700;">${value1}</div>
        </td></tr>
      </table>
    </td>
    <td width="50%" valign="top" style="padding:5px 0 5px 5px;">
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:8px;">
        <tr><td style="padding:20px 22px;">
          <div style="color:#888888;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">${label2}</div>
          <div style="color:#FFFFFF;font-size:26px;font-weight:700;">${value2}</div>
        </td></tr>
      </table>
    </td>
  </tr>`;
}

function sectionTitle(text, color = '#C9A84C') {
  return `<div style="color:${color};font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:20px;">${text}</div>`;
}

function pillButton(url, label = 'View Full Report →') {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td align="center" bgcolor="#C9A84C" style="background-color:#C9A84C;border-radius:999px;padding:14px 36px;">
        <a href="${url}" style="color:#0A0A0F;font-size:15px;font-weight:700;text-decoration:none;display:block;white-space:nowrap;">${label}</a>
      </td>
    </tr>
  </table>`;
}

export function generateEmailHtml(data, displayDate, reportUrl, chartUrl = null) {
  const { locations, retailLocations } = data;
  const loc = locations[0];
  const retail = retailLocations?.[0];
  const { sales, labor, timeSeries: ts, voids } = loc;

  const dow = dayOfWeek(displayDate);
  const isWeekend = dow === 'Saturday' || dow === 'Sunday';
  const badgeColor = isWeekend ? '#C9A84C' : '#888888';
  const badgeBg    = isWeekend ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.06)';

  let peakLine = '';
  if (ts && ts.revenue.length) {
    const peakIdx = ts.revenue.indexOf(Math.max(...ts.revenue));
    peakLine = `Peak: <strong>${ts.labels[peakIdx]}</strong> &mdash; <strong>${fmt$(ts.revenue[peakIdx])}</strong> revenue, <strong>${ts.headcount[peakIdx]}</strong> staff on floor`;
  }

  // Retail totals
  const catData = retail?.topItemsByCategory || {};
  let foodRevenue = 0, foodQty = 0, nonfoodRevenue = 0, nonfoodQty = 0;
  const allRetailItems = [];
  for (const [cat, d] of Object.entries(catData)) {
    const lower = cat.toLowerCase();
    const isFood = lower.includes('food') && !lower.includes('non');
    if (isFood) { foodRevenue += d.totalRevenue; foodQty += d.totalQty; }
    else { nonfoodRevenue += d.totalRevenue; nonfoodQty += d.totalQty; }
    for (const item of d.items) allRetailItems.push({ ...item, category: cat });
  }
  allRetailItems.sort((a, b) => b.qty - a.qty);
  const totalRetailRevenue = foodRevenue + nonfoodRevenue;
  const totalRetailQty = foodQty + nonfoodQty;

  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

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
    </td></tr>
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;

  // ALERTS
  const hasOT = labor.otCount > 0;
  const hasMB = labor.missedBreakCount > 0;
  if (hasOT || hasMB) {
    html += `
<!-- ALERTS -->
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>`;
    if (hasOT) {
      html += `
      <td valign="top" style="padding-right:${hasMB ? '5px' : '0'};">
        <table width="100%" cellpadding="14" cellspacing="0" bgcolor="#1e1010" style="background-color:#1e1010;border-radius:6px;border-left:3px solid #FF6B6B;">
          <tr><td>
            <div style="color:#FF6B6B;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">OVERTIME</div>
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;">${labor.otCount} employees</div>
            <div style="color:#FF6B6B;font-size:13px;margin-top:3px;">Extra cost: ${fmt$(labor.totalOtCost)}</div>
          </td></tr>
        </table>
      </td>`;
    }
    if (hasMB) {
      html += `
      <td valign="top" style="padding-left:${hasOT ? '5px' : '0'};">
        <table width="100%" cellpadding="14" cellspacing="0" bgcolor="#1e1a0a" style="background-color:#1e1a0a;border-radius:6px;border-left:3px solid #C9A84C;">
          <tr><td>
            <div style="color:#C9A84C;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">MISSED BREAKS</div>
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;">${labor.missedBreakCount} employees</div>
            <div style="color:#C9A84C;font-size:13px;margin-top:3px;">CA liability risk</div>
          </td></tr>
        </table>
      </td>`;
    }
    html += `
    </tr>
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
  }

  // OVERTIME TABLE
  if (labor.overtime?.length) {
    const fmtOT = (h) => h >= 1 ? `+${h}h OT` : `+${Math.round(h * 60)}min OT`;
    html += `
<!-- OVERTIME TABLE -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:24px 22px 18px;">
  <div style="color:#C9A84C;font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:20px;">Overtime &mdash; ${labor.otCount} Employee${labor.otCount !== 1 ? 's' : ''}</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="50%" style="color:#555555;font-size:11px;font-weight:700;letter-spacing:1px;padding-bottom:10px;border-bottom:1px solid #222222;">EMPLOYEE</td>
      <td width="30%" style="color:#555555;font-size:11px;font-weight:700;letter-spacing:1px;padding-bottom:10px;border-bottom:1px solid #222222;">SHIFT &amp; OT</td>
      <td align="right" width="20%" style="color:#555555;font-size:11px;font-weight:700;letter-spacing:1px;padding-bottom:10px;border-bottom:1px solid #222222;">EXTRA COST</td>
    </tr>`;
    for (const emp of labor.overtime) {
      const dtBadge = emp.doubleTime
        ? ` <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;color:#FF6B6B;background-color:rgba(255,107,107,.12);border:1px solid rgba(255,107,107,.3);">2×</span>`
        : '';
      html += `
    <tr>
      <td style="padding:13px 12px 13px 0;border-bottom:1px solid #1a1a1a;">
        <div style="color:#FFFFFF;font-size:16px;font-weight:700;">${emp.name}${dtBadge}</div>
        <div style="color:#555555;font-size:12px;margin-top:3px;">${fmt$(emp.wage)}/h</div>
      </td>
      <td style="padding:13px 8px;border-bottom:1px solid #1a1a1a;white-space:nowrap;">
        <span style="color:#999999;font-size:16px;">${emp.hours}h</span>
        <span style="color:#C9A84C;font-size:16px;font-weight:700;margin-left:6px;">${fmtOT(emp.otHours)}</span>
      </td>
      <td align="right" style="color:#C9A84C;font-size:16px;font-weight:700;padding:13px 0;border-bottom:1px solid #1a1a1a;white-space:nowrap;">+${fmt$(emp.extraCost)}</td>
    </tr>`;
    }
    html += `
    <tr>
      <td colspan="2" style="color:#666666;font-size:12px;padding:12px 0 4px;">Total extra labor cost</td>
      <td align="right" style="color:#C9A84C;font-size:17px;font-weight:700;padding:12px 0 4px;white-space:nowrap;">+${fmt$(labor.totalOtCost)}</td>
    </tr>
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
  }

  // METRICS — 2 columns, 3 rows
  html += `
<!-- METRICS -->
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${metricRow('Gross Sales', fmt$(sales.grossSales), 'Net Sales', fmt$(sales.netSales))}
    ${metricRow('Orders', sales.orderCount.toLocaleString(), 'Avg Check', fmt$(sales.avgCheck))}
    ${metricRow('Tips', fmt$(sales.tipTotal), 'Hours Worked', labor.totalHours + 'h')}
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;

  // DAY AT A GLANCE
  if (chartUrl || peakLine) {
    html += `
<!-- DAY AT A GLANCE -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:22px 20px 18px;">
  <div style="color:#888888;font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:14px;">Day at a Glance</div>`;
    if (chartUrl) {
      html += `
  <img src="${chartUrl}" width="508" alt="Day at a glance chart" style="display:block;max-width:100%;border-radius:4px;">`;
    } else {
      html += `
  <div style="color:#FFFFFF;font-size:16px;line-height:1.5;">${peakLine}</div>`;
    }
    html += `
  <div style="margin-top:8px;"><a href="${reportUrl}" style="color:#C9A84C;text-decoration:none;font-size:12px;font-weight:600;">Open interactive chart →</a></div>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
  }

  // TOP SELLERS
  if (sales.topItems?.length) {
    html += `
<!-- TOP SELLERS -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:24px 22px 14px;">
  ${sectionTitle('Top Sellers')}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="5%" style="color:#444444;font-size:11px;font-weight:700;padding-bottom:10px;border-bottom:1px solid #222222;">#</td>
      <td width="65%" style="color:#444444;font-size:11px;font-weight:700;padding-bottom:10px;border-bottom:1px solid #222222;">ITEM</td>
      <td align="right" width="12%" style="color:#444444;font-size:11px;font-weight:700;padding-bottom:10px;border-bottom:1px solid #222222;">QTY</td>
      <td align="right" width="18%" style="color:#444444;font-size:11px;font-weight:700;padding-bottom:10px;border-bottom:1px solid #222222;">REVENUE</td>
    </tr>`;
    sales.topItems.slice(0, 10).forEach((item, i) => {
      html += `
    <tr>
      <td style="color:#555555;font-size:16px;padding:11px 4px 11px 0;">${i + 1}</td>
      <td style="color:#FFFFFF;font-size:16px;padding:11px 8px 11px 0;">${item.name}</td>
      <td align="right" style="color:#FFFFFF;font-size:16px;padding:11px 4px;white-space:nowrap;">${item.qty}</td>
      <td align="right" style="color:#C9A84C;font-size:16px;padding:11px 0 11px 4px;white-space:nowrap;">${fmt$(item.revenue)}</td>
    </tr>`;
    });
    html += `
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
  }

  // RETAIL
  if (Object.keys(catData).length > 0) {
    html += `
<!-- RETAIL SUMMARY -->
<tr><td style="padding-top:10px;">
  ${sectionTitle('Retail Top Sellers')}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="33%" valign="top" style="padding-right:5px;">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;border-top:2px solid #4ECDC4;">
          <tr><td align="center" style="padding:16px 8px;">
            <div style="color:#4ECDC4;font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:8px;">FOOD</div>
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;">${fmt$(foodRevenue)}</div>
            <div style="color:#666666;font-size:12px;margin-top:4px;">${foodQty} items</div>
          </td></tr>
        </table>
      </td>
      <td width="33%" valign="top" style="padding:0 2px;">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;border-top:2px solid #C9A84C;">
          <tr><td align="center" style="padding:16px 8px;">
            <div style="color:#C9A84C;font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:8px;">NON-FOOD</div>
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;">${fmt$(nonfoodRevenue)}</div>
            <div style="color:#666666;font-size:12px;margin-top:4px;">${nonfoodQty} items</div>
          </td></tr>
        </table>
      </td>
      <td width="33%" valign="top" style="padding-left:5px;">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;border-top:2px solid #555555;">
          <tr><td align="center" style="padding:16px 8px;">
            <div style="color:#999999;font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:8px;">TOTAL</div>
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;">${fmt$(totalRetailRevenue)}</div>
            <div style="color:#666666;font-size:12px;margin-top:4px;">${totalRetailQty} items</div>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;

    if (allRetailItems.length) {
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:24px 22px 14px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="70%" style="color:#444444;font-size:11px;font-weight:700;padding-bottom:10px;border-bottom:1px solid #222222;">ITEM</td>
      <td align="right" width="12%" style="color:#444444;font-size:11px;font-weight:700;padding-bottom:10px;border-bottom:1px solid #222222;">QTY</td>
      <td align="right" width="18%" style="color:#444444;font-size:11px;font-weight:700;padding-bottom:10px;border-bottom:1px solid #222222;">REVENUE</td>
    </tr>`;
      allRetailItems.slice(0, 15).forEach(item => {
        html += `
    <tr>
      <td style="color:#FFFFFF;font-size:16px;padding:11px 8px 11px 0;">${item.name}</td>
      <td align="right" style="color:#FFFFFF;font-size:16px;padding:11px 4px;white-space:nowrap;">${item.qty}</td>
      <td align="right" style="color:#C9A84C;font-size:16px;padding:11px 0 11px 4px;white-space:nowrap;">${fmt$(item.revenue)}</td>
    </tr>`;
      });
      html += `
  </table>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
    }
  }

  // DISCOUNTS
  if (sales.discounts?.length) {
    html += `
<!-- DISCOUNTS -->
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
  if (voids.count > 0) {
    html += `
<!-- VOIDS -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:10px;padding:22px 24px;">
  <div style="color:#FF6B6B;font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:14px;">Voids</div>
  <div style="color:#FFFFFF;font-size:17px;text-align:center;">${voids.count} voided order${voids.count !== 1 ? 's' : ''} &nbsp;&middot;&nbsp; <span style="color:#FF6B6B;">${fmt$(voids.totalAmount)}</span> total</div>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
  }

  // FOOTER
  html += `
<!-- FOOTER -->
<tr><td align="center" style="padding:20px 0 4px;">
  ${pillButton(reportUrl)}
  <div style="color:#333333;font-size:11px;margin-top:16px;">Jeannine's Restaurant &amp; Bakery &middot; Santa Barbara, CA</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { html };
}
