export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function humanDateStr(isoDate) {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

async function fetchHolidays(dateStr) {
  try {
    const year = dateStr.slice(0, 4);
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`);
    if (!res.ok) return [];
    const holidays = await res.json();
    return holidays.filter(h => h.date === dateStr).map(h => h.name);
  } catch {
    return [];
  }
}

// Only run in May–June (graduation season). Returns a single short string or null.
async function fetchGraduation(dateStr) {
  const month = dateStr.slice(5, 7);
  if (month !== '05' && month !== '06') return null;

  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;

  try {
    const year = dateStr.slice(0, 4);
    const humanDate = humanDateStr(dateStr);
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: `UCSB commencement graduation ceremony Santa Barbara ${year} ${humanDate}`,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const answer = (data.answer || '').replace(/^On\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4},?\s*/i, '').trim();
    const lower = answer.toLowerCase();
    const isGrad = lower.includes('graduation') || lower.includes('commencement') || lower.includes('ucsb');
    const isBad = ['no specific', "i couldn't", "i don't", 'no information', 'unable'].some(p => lower.includes(p));
    if (answer.length >= 15 && isGrad && !isBad) {
      const humanDate = humanDateStr(dateStr);
      let first = answer.split(/(?<=[.!?])\s+/)[0].trim();
      // Replace the literal date with "today" and clean up scheduling language
      const escaped = humanDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      first = first
        .replace(new RegExp(`is scheduled for ${escaped}`, 'i'), 'was today')
        .replace(new RegExp(`will (take place|be held|occur) on ${escaped}`, 'i'), 'was today')
        .replace(new RegExp(escaped, 'i'), 'today')
        .replace(/\bis today\b/gi, 'was today')
        .replace(/,?\s+at\s+\d[\d:]*\s*(a\.?m\.?|p\.?m\.?)/gi, '')  // strip ", at 9 a.m."
        .replace(/^The\s+/i, '')
        .trim();
      return first.length > 150 ? first.slice(0, 147) + '…' : first;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchSpecialEvents(dateStr) {
  const [todayHolidays, tomorrowHolidays, dayAfterHolidays, graduation] = await Promise.all([
    fetchHolidays(dateStr),
    fetchHolidays(addDays(dateStr, 1)),
    fetchHolidays(addDays(dateStr, 2)),
    fetchGraduation(dateStr),
  ]);

  const todayLocal = graduation ? [graduation] : [];
  const hasAny = todayHolidays.length || todayLocal.length || tomorrowHolidays.length || dayAfterHolidays.length;
  if (!hasAny) return null;

  return {
    today:    { holidays: todayHolidays,    local: todayLocal },
    tomorrow: { holidays: tomorrowHolidays, local: [] },
    dayAfter: { holidays: dayAfterHolidays, local: [] },
  };
}
