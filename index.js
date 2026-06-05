import { authenticate, getRestaurantGuids, fetchRestaurantInfo, fetchOrders, fetchLaborEntries, fetchEmployees, fetchSalesCategories, fetchItemAvailabilities } from './lib/toast.js';
import { crunchOrders, crunchLabor, crunchVoids, crunchRetailByCategory, buildTimeSeries } from './lib/process.js';
import { render } from './lib/report.js';
import { generateEmailHtml } from './lib/email-report.js';
import { generateChartGif } from './lib/chart-gif.js';
import { publishReport, publishChartImage } from './lib/publish.js';
import { writeReport } from './lib/airtable.js';
import { sendEmail, sendSms } from './lib/notify.js';

function parseDate() {
  const arg = process.argv.find(a => a.startsWith('--date='))?.slice(7);
  if (arg) return arg; // expect YYYY-MM-DD
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function toBusinessDate(isoDate) {
  return isoDate.replace(/-/g, ''); // YYYYMMDD
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const displayDate = parseDate();
  const businessDate = toBusinessDate(displayDate);
  console.log(`\nJeannine's Report — ${displayDate}\n${'─'.repeat(40)}`);

  await authenticate();

  const guids = getRestaurantGuids();
  console.log(`Locations: ${guids.length}\n`);

  // Fetch 86'd items (current snapshot) — restaurant report only, not historical
  const rawAvailabilities = await fetchItemAvailabilities(guids[0]);
  const eightySixedItems = rawAvailabilities.filter(i =>
    i.outOfStock === true || i.status === 'OUT_OF_STOCK'
  );
  if (eightySixedItems.length) console.log(`86'd items: ${eightySixedItems.length}`);

  // Build set of retail sales category GUIDs from config API
  const retailCategoryNames = (process.env.TOAST_RETAIL_CATEGORY_NAMES || 'Retail Non-Food,Retail Food')
    .split(',').map(s => s.trim());
  const allCategories = await fetchSalesCategories(guids[0]);
  const categoryGuidToName = new Map(
    allCategories.filter(c => retailCategoryNames.includes(c.name)).map(c => [c.guid, c.name])
  );
  const retailCategorySet = new Set(categoryGuidToName.keys());
  console.log(`Retail categories: ${retailCategorySet.size} matched (${retailCategoryNames.join(', ')})\n`);

  const locationData = [];
  const retailData = [];

  for (let i = 0; i < guids.length; i++) {
    const guid = guids[i];
    console.log(`[${i + 1}/${guids.length}] Fetching ${guid.slice(0, 8)}...`);

    const [info, orders, labor, employees] = await Promise.all([
      fetchRestaurantInfo(guid),
      fetchOrders(guid, businessDate),
      fetchLaborEntries(guid, businessDate),
      fetchEmployees(guid),
    ]);

    const employeeMap = Object.fromEntries(employees.map(e => [e.guid, e]));
    const sales = crunchOrders(orders);                              // all orders (restaurant view)
    const retailSales = crunchOrders(orders, retailCategorySet);     // retail category items only
    const retailByCategory = crunchRetailByCategory(orders, categoryGuidToName);
    const laborStats = crunchLabor(labor, employeeMap);
    const timeSeries = buildTimeSeries(orders, labor, employeeMap);
    const voids = crunchVoids(orders);

    console.log(`  ${info.name}: ${sales.orderCount} orders | Net $${sales.netSales.toFixed(2)} | Retail $${retailSales.grossSales.toFixed(2)} (${retailSales.orderCount} txns) | ${laborStats.overtime.length} OT | ${voids.count} voids`);
    locationData.push({ guid, name: info.name, sales, labor: laborStats, timeSeries, voids });
    retailData.push({ guid, name: info.name, sales: retailSales, topItemsByCategory: retailByCategory });

    if (i < guids.length - 1) await sleep(5000); // respect rate limits between locations
  }

  // Combined totals
  const totals = locationData.reduce((acc, loc) => {
    acc.grossSales += loc.sales.grossSales;
    acc.netSales += loc.sales.netSales;
    acc.orderCount += loc.sales.orderCount;
    acc.tipTotal += loc.sales.tipTotal;
    acc.totalHours = Math.round((acc.totalHours + loc.labor.totalHours) * 10) / 10;
    return acc;
  }, { grossSales: 0, netSales: 0, orderCount: 0, tipTotal: 0, totalHours: 0, avgCheck: 0 });
  totals.avgCheck = totals.orderCount > 0 ? totals.netSales / totals.orderCount : 0;

  console.log('\nBuilding report...');
  const html = render({ locations: locationData, totals, eightySixedItems, retailLocations: retailData }, displayDate);

  console.log('Publishing to GitHub...');
  const reportUrl = await publishReport(html, displayDate);
  console.log(`  URL: ${reportUrl}`);

  console.log('Writing to Airtable...');
  await writeReport(locationData, displayDate, reportUrl, 'Restaurant');
  await writeReport(retailData, displayDate, reportUrl, 'Retail');

  console.log('Sending notifications...');
  const timeSeries = locationData[0]?.timeSeries;
  const chartBuffer = await generateChartGif(timeSeries);
  let chartUrl = null;
  if (chartBuffer) {
    console.log('  Publishing chart image...');
    chartUrl = await publishChartImage(chartBuffer, displayDate);
    console.log(`  Chart URL: ${chartUrl}`);
  }
  const { html: emailHtml } = generateEmailHtml({ locations: locationData, totals, eightySixedItems, retailLocations: retailData }, displayDate, reportUrl, chartUrl);
  await sendEmail(emailHtml, displayDate);
  await sendSms(displayDate, reportUrl);

  console.log(`\nDone. ${reportUrl}\n`);
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
