function humanDateStr(isoDate) {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

async function fetchNationalHolidays(dateStr) {
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

// These must appear in the TITLE for a result to qualify — not just the description
const TITLE_EVENT_KEYWORDS = [
  'graduation', 'commencement', 'festival', 'parade', 'fair', 'concert',
  'ceremony', 'fiesta', 'market', 'race', 'tournament', 'celebration',
  'performance', 'show', 'exhibit', 'expo', 'gala', 'opening night',
  'championship', 'competition', 'run', 'walk', 'marathon', 'closure',
];

// Skip results whose title is a generic calendar/listing page
const GENERIC_TITLE = [
  /^events?(\s+calendar)?$/i,
  /^month\s+calendar$/i,
  /^events?\s+from\b/i,
  /^events?\s+(listing|listings)$/i,
  /^(what'?s?\s+on|things\s+to\s+do)$/i,
  /^(upcoming\s+)?events?\s+in\s+/i,
  /^santa\s+barbara\s+events?$/i,
  /^goleta\s+events?$/i,
  /^calendar\s+of\s+events?$/i,
];

async function fetchLocalEvents(dateStr) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];

  try {
    const humanDate = humanDateStr(dateStr);
    const res = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        query: `Santa Barbara "${humanDate}" special event OR festival OR graduation OR parade`,
        limit: 5,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) return [];

    const SB_LOCATION_KW = ['santa barbara', 'goleta', 'montecito', 'ucsb', 'carpinteria', 'state street', 'la cumbre'];

    const results = [];
    for (const item of data.data) {
      const rawTitle = (item.title || '').replace(/\s*[|–—-]\s*.+$/, '').trim();
      // Too short, too long (likely a description snippet), or generic calendar page
      if (!rawTitle || rawTitle.length < 8 || rawTitle.length > 65) continue;
      if (GENERIC_TITLE.some(p => p.test(rawTitle))) continue;
      const titleLower = rawTitle.toLowerCase();
      if (!TITLE_EVENT_KEYWORDS.some(kw => titleLower.includes(kw))) continue;
      // Title OR description must reference the SB area
      const fullText = (rawTitle + ' ' + (item.description || '')).toLowerCase();
      if (!SB_LOCATION_KW.some(kw => fullText.includes(kw))) continue;
      results.push(rawTitle);
    }
    return results;
  } catch {
    return [];
  }
}

export async function fetchSpecialEvents(dateStr) {
  const [national, local] = await Promise.all([
    fetchNationalHolidays(dateStr),
    fetchLocalEvents(dateStr),
  ]);
  if (!national.length && !local.length) return null;
  return { national, local };
}
