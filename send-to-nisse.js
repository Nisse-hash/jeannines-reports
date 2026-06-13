import 'dotenv/config';
import { authenticate, getRestaurantGuids, fetchRestaurantInfo, fetchOrders, fetchLaborEntries, fetchEmployees, fetchSalesCategories } from './lib/toast.js';
import { crunchOrders, crunchLabor, crunchVoids, crunchRetailByCategory, buildTimeSeries } from './lib/process.js';
import { generateEmailHtml } from './lib/email-report.js';
import { generateChartGif } from './lib/chart-gif.js';
import { publishChartImage } from './lib/publish.js';
import { fetchWeather, LOCATION_COORDS } from './lib/weather.js';
import nodemailer from 'nodemailer';

const displayDate = process.argv.find(a => a.startsWith('--date='))?.slice(7)
  ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const reportUrl = `https://jeannines-reports.vercel.app/reports/${displayDate}.html`;

await authenticate();
const guids = getRestaurantGuids();
const retailCategoryNames = (process.env.TOAST_RETAIL_CATEGORY_NAMES || 'Retail Non-Food,Retail Food').split(',').map(s => s.trim());
const allCategoriesRaw = await Promise.all(guids.map(g => fetchSalesCategories(g)));
const seenCatGuids = new Set();
const allCategories = allCategoriesRaw.flat().filter(c => {
  if (seenCatGuids.has(c.guid)) return false;
  seenCatGuids.add(c.guid);
  return true;
});
const categoryGuidToName = new Map(allCategories.filter(c => retailCategoryNames.includes(c.name)).map(c => [c.guid, c.name]));
const retailCategorySet = new Set(categoryGuidToName.keys());
const businessDate = displayDate.replace(/-/g, '');
const locationData = [], retailData = [];

for (let i = 0; i < guids.length; i++) {
  const guid = guids[i];
  const [info, orders, labor, employees] = await Promise.all([
    fetchRestaurantInfo(guid), fetchOrders(guid, businessDate),
    fetchLaborEntries(guid, businessDate), fetchEmployees(guid),
  ]);
  const employeeMap = Object.fromEntries(employees.map(e => [e.guid, e]));
  locationData.push({ guid, name: info.name, sales: crunchOrders(orders), labor: crunchLabor(labor, employeeMap), timeSeries: buildTimeSeries(orders, labor, employeeMap), voids: crunchVoids(orders) });
  retailData.push({ guid, name: info.name, sales: crunchOrders(orders, retailCategorySet), topItemsByCategory: crunchRetailByCategory(orders, categoryGuidToName) });
  if (i < guids.length - 1) await new Promise(r => setTimeout(r, 3000));
}

for (const loc of locationData) {
  const coords = LOCATION_COORDS[loc.guid];
  if (coords) loc.weather = await fetchWeather(displayDate, coords.lat, coords.lon, coords.addr);
}

// Generate and publish a chart per location
const chartUrls = [];
for (let i = 0; i < locationData.length; i++) {
  const buf = await generateChartGif(locationData[i]?.timeSeries);
  if (buf) {
    console.log(`Publishing chart ${i + 1}/${locationData.length}...`);
    const url = await publishChartImage(buf, displayDate, `-${i}`);
    chartUrls.push(url);
    console.log(`  Chart ${i + 1}: ${url}`);
  } else {
    chartUrls.push(null);
  }
}

const { html: emailHtml } = generateEmailHtml(
  { locations: locationData, retailLocations: retailData },
  displayDate, reportUrl, chartUrls, locationData[0]?.weather ?? null,
  process.env.REPORT_LINK_TOKEN || null
);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 587, secure: false,
  auth: { type: 'OAuth2', user: process.env.GMAIL_EMAIL_NISSE, clientId: process.env.GMAIL_CLIENT_ID_NISSE, clientSecret: process.env.GMAIL_CLIENT_SECRET_NISSE, refreshToken: process.env.GMAIL_REFRESH_TOKEN_NISSE },
  connectionTimeout: 30_000, socketTimeout: 30_000,
});
await transporter.sendMail({
  from: `"Jeannine's Reports" <${process.env.GMAIL_EMAIL_NISSE}>`,
  to: 'nisse@jeannines.com',
  subject: `Today's Report — Jeannine's (${displayDate})`,
  html: emailHtml,
});
console.log('Sent to nisse@jeannines.com');
