// retailCategorySet: when provided (a Set of salesCategory GUIDs), only count items in those categories.
// When null (default), process all orders normally (restaurant mode).
export function crunchOrders(orders, retailCategorySet = null) {
  const live = orders.filter(o => !o.voided && !o.createdInTestMode && !o.excessFood);

  let grossSales = 0, taxTotal = 0, discountTotal = 0, tipTotal = 0;
  const itemMap = {};
  const discountMap = {};
  const retailOrderIds = new Set();

  for (const order of live) {
    for (const check of (order.checks || [])) {
      if (retailCategorySet === null) {
        grossSales    += check.totalAmount    || 0;
        taxTotal      += check.taxAmount      || 0;
        discountTotal += check.discountAmount || 0;
        for (const payment of (check.payments || [])) {
          if (!payment.voidInfo) tipTotal += payment.tipAmount || 0;
        }
        for (const d of (check.appliedDiscounts || [])) {
          const name = d.appliedDiscountReason?.name || d.discount?.name || d.name || 'Discount';
          if (!discountMap[name]) discountMap[name] = { name, count: 0, total: 0 };
          discountMap[name].count++;
          discountMap[name].total += d.discountAmount || 0;
        }
      }

      for (const sel of (check.selections || [])) {
        if (sel.voided) continue;

        if (retailCategorySet !== null) {
          const scGuid = sel.salesCategory?.guid;
          if (!retailCategorySet.has(scGuid)) continue;
          retailOrderIds.add(order.guid);
          grossSales += (sel.price || 0) * (sel.quantity || 1);
        }

        if (retailCategorySet === null) {
          for (const d of (sel.appliedDiscounts || [])) {
            const dname = d.appliedDiscountReason?.name || d.discount?.name || d.name || 'Discount';
            if (!discountMap[dname]) discountMap[dname] = { name: dname, count: 0, total: 0 };
            discountMap[dname].count++;
            discountMap[dname].total += d.discountAmount || 0;
          }
        }

        const key = sel.itemGuid || sel.displayName || 'unknown';
        const name = sel.displayName || 'Unknown Item';
        const qty  = sel.quantity || 1;
        const category = sel.salesCategory?.name || '';
        if (!itemMap[key]) itemMap[key] = { name, qty: 0, revenue: 0, category };
        itemMap[key].qty     += qty;
        itemMap[key].revenue += (sel.price || 0) * qty;
      }
    }
  }

  const netSales   = retailCategorySet !== null ? grossSales : grossSales - taxTotal - discountTotal;
  const orderCount = retailCategorySet !== null ? retailOrderIds.size : live.length;
  const avgCheck   = orderCount > 0 ? netSales / orderCount : 0;
  const topItems   = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 20);
  const discounts  = Object.values(discountMap).sort((a, b) => b.total - a.total);
  const appliedDiscountTotal = discounts.reduce((s, d) => s + d.total, 0);

  return { grossSales, netSales, taxTotal, discountTotal: appliedDiscountTotal, tipTotal, orderCount, avgCheck, topItems, discounts };
}

export function crunchRetailByCategory(orders, categoryGuidToName) {
  const live = orders.filter(o => !o.voided && !o.createdInTestMode && !o.excessFood);
  const byCategory = {};
  for (const order of live) {
    for (const check of (order.checks || [])) {
      for (const sel of (check.selections || [])) {
        if (sel.voided) continue;
        const catGuid = sel.salesCategory?.guid;
        if (!catGuid || !categoryGuidToName.has(catGuid)) continue;
        const cat  = categoryGuidToName.get(catGuid);
        const key  = sel.itemGuid || sel.displayName || 'Unknown';
        const name = sel.displayName || key;
        const qty  = sel.quantity || 1;
        if (!byCategory[cat]) byCategory[cat] = {};
        if (!byCategory[cat][key]) byCategory[cat][key] = { name, qty: 0, revenue: 0 };
        byCategory[cat][key].qty     += qty;
        byCategory[cat][key].revenue += (sel.price || 0) * qty;
      }
    }
  }
  const result = {};
  for (const [cat, itemMap] of Object.entries(byCategory)) {
    const all          = Object.values(itemMap);
    const totalQty     = all.reduce((s, i) => s + i.qty, 0);
    const totalRevenue = Math.round(all.reduce((s, i) => s + i.revenue, 0) * 100) / 100;
    result[cat] = { items: all.sort((a, b) => b.qty - a.qty).slice(0, 20), totalQty, totalRevenue };
  }
  return result;
}

export function crunchVoids(orders) {
  const voided = orders.filter(o => o.voided);
  const voids = voided.map(o => {
    const amount = (o.checks || []).reduce((s, c) => s + (c.totalAmount || 0), 0);
    const vi = o.voidInfo || {};
    const voidedBy = vi.voidUser
      ? [vi.voidUser.firstName, vi.voidUser.lastName].filter(Boolean).join(' ')
      : 'Unknown';
    return {
      openedAt: o.openedDate,
      voidedAt: vi.voidDate || null,
      voidedBy,
      reason: vi.reason || '',
      amount,
    };
  }).sort((a, b) => b.amount - a.amount);

  return {
    count: voids.length,
    totalAmount: Math.round(voids.reduce((s, v) => s + v.amount, 0) * 100) / 100,
    voids,
  };
}

// California overtime: >8h/day = 1.5x, >12h/day = 2x
export function crunchLabor(timeEntries, employeeMap = {}) {
  const byEmployee = {};

  for (const entry of (timeEntries || [])) {
    if (!entry.inDate || !entry.outDate) continue;

    const empId = entry.employee?.guid || entry.employeeReference?.guid || 'unknown';
    const emp = employeeMap[empId];
    const name = emp
      ? [emp.firstName, emp.lastName].filter(Boolean).join(' ')
      : `Employee ${empId.slice(0, 6)}`;

    const hours = (new Date(entry.outDate) - new Date(entry.inDate)) / 3_600_000;

    if (!byEmployee[empId]) byEmployee[empId] = { name, hours: 0, wage: entry.hourlyWage || 0 };
    byEmployee[empId].hours += hours;
  }

  const all = Object.values(byEmployee);
  const totalHours = all.reduce((s, e) => s + e.hours, 0);

  const overtime = all
    .filter(e => e.hours - 8 > 0.016) // > 1 min past 8h, ignores float precision on exact 8.00h
    .map(e => {
      const total = Math.round(e.hours * 10) / 10;
      const otHours = Math.round((e.hours - 8) * 100) / 100;
      const doubleTime = e.hours > 12;
      // Extra cost = the premium on top of regular pay already owed
      // 1.5x OT: extra = otHours × wage × 0.5
      // 2x OT: extra = (hours 8-12) × wage × 0.5 + (hours 12+) × wage × 1.0
      let extraCost;
      if (doubleTime) {
        extraCost = (4 * e.wage * 0.5) + ((e.hours - 12) * e.wage * 1.0);
      } else {
        extraCost = otHours * e.wage * 0.5;
      }
      return {
        name: e.name,
        hours: total,
        otHours,
        wage: e.wage,
        extraCost: Math.round(extraCost * 100) / 100,
        doubleTime,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  // California law: meal break required before end of 5th hour
  // Flag anyone who worked > 5h with no unpaid break taken (or break marked missed)
  const missedBreaks = [];
  for (const entry of (timeEntries || [])) {
    if (!entry.inDate || !entry.outDate) continue;
    const hours = (new Date(entry.outDate) - new Date(entry.inDate)) / 3_600_000;
    if (hours <= 6) continue; // CA law: break waivable if shift ≤ 6h

    const empId = entry.employee?.guid || entry.employeeReference?.guid || 'unknown';
    const emp = employeeMap[empId];
    const name = emp
      ? [emp.firstName, emp.lastName].filter(Boolean).join(' ')
      : `Employee ${empId.slice(0, 6)}`;

    const breaks = entry.breaks || [];
    const hadValidBreak = breaks.some(b => !b.missed && !b.waived && b.inDate && b.outDate);

    if (!hadValidBreak) {
      missedBreaks.push({
        name,
        hours: Math.round(hours * 10) / 10,
        waived: breaks.some(b => b.waived),
      });
    }
  }

  // Dedupe by name, keep longest shift
  const missedMap = {};
  for (const m of missedBreaks) {
    if (!missedMap[m.name] || m.hours > missedMap[m.name].hours) missedMap[m.name] = m;
  }

  const totalLaborCost = (timeEntries || []).reduce((sum, e) => {
    if (!e.inDate || !e.outDate) return sum;
    const hrs = (new Date(e.outDate) - new Date(e.inDate)) / 3_600_000;
    return sum + hrs * (e.hourlyWage || 0);
  }, 0);

  const missedBreakList = Object.values(missedMap).sort((a, b) => b.hours - a.hours);

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    employeeCount: all.length,
    overtime,
    missedBreaks: missedBreakList,
    totalLaborCost: Math.round(totalLaborCost * 100) / 100,
    otCount: overtime.length,
    totalOtCost: Math.round(overtime.reduce((s, e) => s + (e.extraCost || 0), 0) * 100) / 100,
    missedBreakCount: missedBreakList.length,
  };
}

export function buildTimeSeries(orders, timeEntries, employeeMap = {}) {
  const slotMs = 30 * 60 * 1000;

  const times = [
    ...orders.map(o => o.closedDate || o.openedDate).filter(Boolean).map(t => +new Date(t)),
    ...timeEntries.map(e => e.inDate).filter(Boolean).map(t => +new Date(t)),
    ...timeEntries.map(e => e.outDate).filter(Boolean).map(t => +new Date(t)),
  ];
  if (!times.length) return null;

  const startMs = Math.floor(Math.min(...times) / slotMs) * slotMs;
  const endMs   = Math.ceil(Math.max(...times)  / slotMs) * slotMs;
  const slots   = [];
  for (let t = startMs; t <= endMs; t += slotMs) slots.push(t);

  const revenueBySlot = {};
  for (const order of orders) {
    if (order.voided || order.createdInTestMode) continue;
    const ts = order.closedDate || order.openedDate;
    if (!ts) continue;
    const slot = Math.floor(+new Date(ts) / slotMs) * slotMs;
    if (!revenueBySlot[slot]) revenueBySlot[slot] = 0;
    for (const check of (order.checks || [])) revenueBySlot[slot] += check.totalAmount || 0;
  }

  const headcountBySlot = {}, laborBySlot = {}, staffBySlot = {};
  for (const slot of slots) {
    let count = 0, cost = 0;
    const names = new Set();
    for (const entry of timeEntries) {
      if (!entry.inDate || !entry.outDate) continue;
      const inMs  = +new Date(entry.inDate);
      const outMs = +new Date(entry.outDate);
      if (inMs < slot + slotMs && outMs > slot) {
        count++;
        const overlap = Math.min(outMs, slot + slotMs) - Math.max(inMs, slot);
        cost += (entry.hourlyWage || 0) * (overlap / 3_600_000);
        const empId = entry.employee?.guid || entry.employeeReference?.guid;
        const emp   = empId && employeeMap[empId];
        const name  = emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : null;
        if (name) names.add(name);
      }
    }
    headcountBySlot[slot] = count;
    laborBySlot[slot]     = Math.round(cost * 100) / 100;
    staffBySlot[slot]     = [...names].sort();
  }

  // Labels in PT (UTC-7 PDT)
  const labels = slots.map(t => {
    const pt = new Date(t - 7 * 3_600_000);
    const h = pt.getUTCHours(), m = pt.getUTCMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    return m === 0 ? `${h % 12 || 12}${ap}` : `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
  });

  return {
    labels,
    revenue:   slots.map(s => Math.round((revenueBySlot[s] || 0) * 100) / 100),
    headcount: slots.map(s => headcountBySlot[s] || 0),
    laborCost: slots.map(s => laborBySlot[s] || 0),
    staff:     slots.map(s => staffBySlot[s] || []),
  };
}
