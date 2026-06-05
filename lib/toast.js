const BASE = process.env.TOAST_API_HOSTNAME || 'https://ws-api.toasttab.com';

let _token = null;

export async function authenticate() {
  const res = await fetch(`${BASE}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.TOAST_CLIENT_ID,
      clientSecret: process.env.TOAST_CLIENT_SECRET,
      userAccessType: process.env.TOAST_USER_ACCESS_TYPE || 'TOAST_MACHINE_CLIENT',
    }),
  });
  if (!res.ok) throw new Error(`Toast auth failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  _token = data.token.accessToken;
  console.log('  Toast authenticated.');
  return _token;
}

function headers(restaurantGuid) {
  return {
    'Authorization': `Bearer ${_token}`,
    'Toast-Restaurant-External-ID': restaurantGuid,
    'Content-Type': 'application/json',
  };
}

export function getRestaurantGuids() {
  const raw = process.env.TOAST_RESTAURANT_GUIDS || process.env.TOAST_RESTAURANT_GUID || '';
  const guids = raw.split(',').map(g => g.trim()).filter(Boolean);
  if (!guids.length) throw new Error('Set TOAST_RESTAURANT_GUID (or TOAST_RESTAURANT_GUIDS) in .env');
  return guids;
}

export async function fetchRestaurantInfo(restaurantGuid) {
  const res = await fetch(`${BASE}/restaurants/v1/restaurants/${restaurantGuid}`, {
    headers: headers(restaurantGuid),
  });
  if (!res.ok) return { name: `Location ${restaurantGuid.slice(0, 8)}` };
  const data = await res.json();
  const locationName = data.general?.locationName || data.general?.name || data.name;
  return { name: locationName || `Location ${restaurantGuid.slice(0, 8)}` };
}

// businessDate format: YYYYMMDD
function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

export async function fetchOrders(restaurantGuid, businessDate) {
  const orders = [];
  let nextUrl = `${BASE}/orders/v2/ordersBulk?businessDate=${businessDate}`;
  let page = 1;

  while (nextUrl) {
    const res = await fetch(nextUrl, { headers: headers(restaurantGuid) });
    if (!res.ok) throw new Error(`Orders fetch failed for ${restaurantGuid}: ${res.status} ${await res.text()}`);

    const data = await res.json();
    const batch = Array.isArray(data) ? data : (data.orders || []);
    orders.push(...batch);
    console.log(`  Page ${page}: ${batch.length} orders (total so far: ${orders.length})`);
    page++;

    nextUrl = parseNextLink(res.headers.get('link'));
  }

  return orders;
}

export async function fetchEmployees(restaurantGuid) {
  const res = await fetch(`${BASE}/labor/v1/employees`, {
    headers: headers(restaurantGuid),
  });
  if (!res.ok) {
    console.warn('  Could not fetch employees:', res.status);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.employees || []);
}

export async function fetchSalesCategories(restaurantGuid) {
  const res = await fetch(`${BASE}/config/v2/salesCategories`, {
    headers: headers(restaurantGuid),
  });
  if (!res.ok) {
    console.warn('  Could not fetch sales categories:', res.status);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchItemAvailabilities(restaurantGuid) {
  const res = await fetch(`${BASE}/config/v2/itemAvailabilities`, {
    headers: headers(restaurantGuid),
  });
  if (!res.ok) {
    console.warn('  Could not fetch item availabilities:', res.status);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchLaborEntries(restaurantGuid, businessDate) {
  const url = new URL(`${BASE}/labor/v1/timeEntries`);
  url.searchParams.set('businessDate', businessDate);

  const res = await fetch(url.toString(), { headers: headers(restaurantGuid) });
  if (!res.ok) throw new Error(`Labor fetch failed for ${restaurantGuid}: ${res.status} ${await res.text()}`);

  const data = await res.json();
  return Array.isArray(data) ? data : (data.timeEntries || []);
}
