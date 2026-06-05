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

function typeBadge(cat) {
  if (!cat) return '';
  const lower = cat.toLowerCase();
  const isFood = lower.includes('food') && !lower.includes('non');
  const color = isFood ? '#4ECDC4' : '#C9A84C';
  const bg = isFood ? 'rgba(78,205,196,.15)' : 'rgba(201,168,76,.15)';
  const label = cat.replace(/^Retail\s+/i, '');
  return `<span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 7px;border-radius:3px;color:${color};background-color:${bg};border:1px solid ${color}44;">${label}</span>`;
}

function metricCard(label, value) {
  return `<td width="25%" valign="top" style="padding:4px;">
    <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;">
      <tr><td align="center" style="padding:14px 8px;">
        <div style="color:#999999;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${label}</div>
        <div style="color:#FFFFFF;font-size:19px;font-weight:700;">${value}</div>
      </td></tr>
    </table>
  </td>`;
}

function sectionTitle(text, color = '#C9A84C') {
  return `<div style="color:${color};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">${text}</div>`;
}

function viewButton(url) {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td align="center" bgcolor="#C9A84C" style="background-color:#C9A84C;border-radius:4px;padding:12px 28px;">
        <a href="${url}" style="color:#0A0A0F;font-size:14px;font-weight:700;text-decoration:none;display:block;white-space:nowrap;">View Full Report →</a>
      </td>
    </tr>
  </table>`;
}

export function generateEmailHtml(data, displayDate, reportUrl) {
  const { locations, retailLocations } = data;
  const loc = locations[0];
  const retail = retailLocations?.[0];
  const { sales, labor, timeSeries: ts, voids } = loc;

  const baseUrl = process.env.JEANNINES_REPORT_URL_BASE || 'https://jeannines-reports.vercel.app';
  const prevUrl = `${baseUrl}/reports/${offsetDate(displayDate, -1)}.html`;
  const nextUrl = `${baseUrl}/reports/${offsetDate(displayDate, 1)}.html`;

  const dow = dayOfWeek(displayDate);
  const isWeekend = dow === 'Saturday' || dow === 'Sunday';
  const badgeColor = isWeekend ? '#C9A84C' : '#888888';
  const badgeBg    = isWeekend ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.06)';

  // Peak hour
  let peakLine = '';
  if (ts && ts.revenue.length) {
    const peakIdx = ts.revenue.indexOf(Math.max(...ts.revenue));
    peakLine = `Peak: ${ts.labels[peakIdx]} &mdash; ${fmt$(ts.revenue[peakIdx])} revenue, ${ts.headcount[peakIdx]} staff on floor`;
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

  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jeannine's Daily Report — ${displayDate}</title>
</head>
<body bgcolor="#0A0A0F" style="margin:0;padding:0;background-color:#0A0A0F;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0A0A0F" style="background-color:#0A0A0F;">
<tr><td align="center" style="padding:16px 8px 32px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- HEADER -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:8px;padding:22px 24px 18px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td valign="top">
        <div style="font-size:24px;font-weight:700;color:#C9A84C;margin-bottom:4px;">Jeannine's Daily Report</div>
        <div style="font-size:15px;color:#FFFFFF;margin-bottom:2px;">${displayDate}</div>
        <div style="font-size:11px;color:#666666;">Generated ${now} PT</div>
      </td>
      <td align="right" valign="top" style="padding-left:12px;">
        <span style="display:inline-block;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;color:${badgeColor};background-color:${badgeBg};border:1px solid ${badgeColor}44;">${dow.toUpperCase()}</span>
      </td>
    </tr>
    <tr><td colspan="2" style="padding-top:16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <a href="${prevUrl}" style="color:#999999;font-size:13px;text-decoration:none;padding:6px 14px;border:1px solid #333333;border-radius:4px;display:inline-block;">← Prev</a>
            <a href="${nextUrl}" style="color:#999999;font-size:13px;text-decoration:none;padding:6px 14px;border:1px solid #333333;border-radius:4px;display:inline-block;margin-left:8px;">Next →</a>
          </td>
          <td align="right">
            <a href="${reportUrl}" style="color:#0A0A0F;font-size:13px;font-weight:700;text-decoration:none;padding:8px 18px;background-color:#C9A84C;border-radius:4px;display:inline-block;">View Full Report →</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</td></tr>
<tr><td style="height:10px;"></td></tr>`;

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
        <table width="100%" cellpadding="12" cellspacing="0" bgcolor="#1e1010" style="background-color:#1e1010;border-radius:6px;border-left:3px solid #FF6B6B;">
          <tr><td>
            <div style="color:#FF6B6B;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">OVERTIME</div>
            <div style="color:#FFFFFF;font-size:17px;font-weight:700;">${labor.otCount} employees</div>
            <div style="color:#FF6B6B;font-size:12px;margin-top:2px;">Extra cost: ${fmt$(labor.totalOtCost)}</div>
          </td></tr>
        </table>
      </td>`;
    }
    if (hasMB) {
      html += `
      <td valign="top" style="padding-left:${hasOT ? '5px' : '0'};">
        <table width="100%" cellpadding="12" cellspacing="0" bgcolor="#1e1a0a" style="background-color:#1e1a0a;border-radius:6px;border-left:3px solid #C9A84C;">
          <tr><td>
            <div style="color:#C9A84C;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">MISSED BREAKS</div>
            <div style="color:#FFFFFF;font-size:17px;font-weight:700;">${labor.missedBreakCount} employees</div>
            <div style="color:#C9A84C;font-size:12px;margin-top:2px;">CA liability risk</div>
          </td></tr>
        </table>
      </td>`;
    }
    html += `
    </tr>
  </table>
</td></tr>
<tr><td style="height:10px;"></td></tr>`;
  }

  // METRICS
  html += `
<!-- METRICS -->
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      ${metricCard('Net Sales', fmt$(sales.netSales))}
      ${metricCard('Orders', sales.orderCount.toLocaleString())}
      ${metricCard('Avg Check', fmt$(sales.avgCheck))}
      ${metricCard('Tips', fmt$(sales.tipTotal))}
    </tr>
  </table>
</td></tr>
<tr><td style="height:10px;"></td></tr>`;

  // PEAK HOUR
  if (peakLine) {
    html += `
<!-- PEAK HOUR -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;padding:13px 18px;">
  <div style="color:#666666;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Day at a Glance</div>
  <div style="color:#FFFFFF;font-size:13px;">${peakLine} &nbsp;<a href="${reportUrl}" style="color:#C9A84C;text-decoration:none;font-size:12px;">See chart →</a></div>
</td></tr>
<tr><td style="height:10px;"></td></tr>`;
  }

  // TOP SELLERS
  if (sales.topItems?.length) {
    html += `
<!-- TOP SELLERS -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:8px;padding:18px 18px 10px;">
  ${sectionTitle('Top Sellers')}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="28" style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">#</td>
      <td style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">ITEM</td>
      <td align="right" width="40" style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">QTY</td>
      <td align="right" width="80" style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">REVENUE</td>
    </tr>`;
    sales.topItems.slice(0, 10).forEach((item, i) => {
      html += `
    <tr>
      <td style="color:#555555;font-size:13px;padding:7px 4px 7px 0;">${i + 1}</td>
      <td style="color:#FFFFFF;font-size:13px;padding:7px 8px;">${item.name}</td>
      <td align="right" style="color:#FFFFFF;font-size:13px;padding:7px 4px;white-space:nowrap;">${item.qty}</td>
      <td align="right" style="color:#C9A84C;font-size:13px;padding:7px 0 7px 4px;white-space:nowrap;">${fmt$(item.revenue)}</td>
    </tr>`;
    });
    html += `
  </table>
</td></tr>
<tr><td style="height:10px;"></td></tr>`;
  }

  // RETAIL
  if (Object.keys(catData).length > 0) {
    html += `
<!-- RETAIL SUMMARY -->
<tr><td>
  ${sectionTitle('Retail Top Sellers')}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="33%" valign="top" style="padding-right:5px;">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;border-top:2px solid #4ECDC4;">
          <tr><td align="center" style="padding:14px 8px;">
            <div style="color:#4ECDC4;font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:6px;">FOOD</div>
            <div style="color:#FFFFFF;font-size:17px;font-weight:700;">${fmt$(foodRevenue)}</div>
            <div style="color:#666666;font-size:11px;margin-top:3px;">${foodQty} items</div>
          </td></tr>
        </table>
      </td>
      <td width="33%" valign="top" style="padding:0 2px;">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;border-top:2px solid #C9A84C;">
          <tr><td align="center" style="padding:14px 8px;">
            <div style="color:#C9A84C;font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:6px;">NON-FOOD</div>
            <div style="color:#FFFFFF;font-size:17px;font-weight:700;">${fmt$(nonfoodRevenue)}</div>
            <div style="color:#666666;font-size:11px;margin-top:3px;">${nonfoodQty} items</div>
          </td></tr>
        </table>
      </td>
      <td width="33%" valign="top" style="padding-left:5px;">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13131A" style="background-color:#13131A;border-radius:6px;border-top:2px solid #555555;">
          <tr><td align="center" style="padding:14px 8px;">
            <div style="color:#999999;font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:6px;">TOTAL</div>
            <div style="color:#FFFFFF;font-size:17px;font-weight:700;">${fmt$(totalRetailRevenue)}</div>
            <div style="color:#666666;font-size:11px;margin-top:3px;">${totalRetailQty} items</div>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td style="height:10px;"></td></tr>`;

    if (allRetailItems.length) {
      html += `
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:8px;padding:18px 18px 10px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">ITEM</td>
      <td align="center" width="70" style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">TYPE</td>
      <td align="right" width="40" style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">QTY</td>
      <td align="right" width="80" style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">REVENUE</td>
    </tr>`;
      allRetailItems.slice(0, 15).forEach(item => {
        html += `
    <tr>
      <td style="color:#FFFFFF;font-size:12px;padding:6px 8px 6px 0;">${item.name}</td>
      <td align="center" style="padding:6px 4px;">${typeBadge(item.category)}</td>
      <td align="right" style="color:#FFFFFF;font-size:12px;padding:6px 4px;white-space:nowrap;">${item.qty}</td>
      <td align="right" style="color:#C9A84C;font-size:12px;padding:6px 0 6px 4px;white-space:nowrap;">${fmt$(item.revenue)}</td>
    </tr>`;
      });
      html += `
  </table>
</td></tr>
<tr><td style="height:10px;"></td></tr>`;
    }
  }

  // DISCOUNTS
  if (sales.discounts?.length) {
    html += `
<!-- DISCOUNTS -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:8px;padding:18px 18px 10px;">
  ${sectionTitle(`Discounts &mdash; ${fmt$(sales.discountTotal)} total`)}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">PROGRAM</td>
      <td align="right" width="50" style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">TIMES</td>
      <td align="right" width="80" style="color:#444444;font-size:10px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #222222;">TOTAL</td>
    </tr>`;
    sales.discounts.forEach(d => {
      html += `
    <tr>
      <td style="color:#FFFFFF;font-size:12px;padding:6px 0;">${d.name}</td>
      <td align="right" style="color:#999999;font-size:12px;padding:6px 4px;">${d.count}</td>
      <td align="right" style="color:#C9A84C;font-size:12px;padding:6px 0;">${fmt$(d.total)}</td>
    </tr>`;
    });
    html += `
  </table>
</td></tr>
<tr><td style="height:10px;"></td></tr>`;
  }

  // VOIDS
  if (voids.count > 0) {
    html += `
<!-- VOIDS -->
<tr><td bgcolor="#13131A" style="background-color:#13131A;border-radius:8px;padding:14px 18px;">
  <div style="color:#FF6B6B;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Voids</div>
  <div style="color:#FFFFFF;font-size:13px;">${voids.count} voided order${voids.count !== 1 ? 's' : ''} &nbsp;&middot;&nbsp; <span style="color:#FF6B6B;">${fmt$(voids.totalAmount)}</span> total</div>
</td></tr>
<tr><td style="height:10px;"></td></tr>`;
  }

  // FOOTER
  html += `
<!-- FOOTER -->
<tr><td align="center" style="padding:20px 0 4px;">
  ${viewButton(reportUrl)}
  <div style="color:#333333;font-size:11px;margin-top:16px;">Jeannine's Restaurant &amp; Bakery &middot; Santa Barbara, CA</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return html;
}
