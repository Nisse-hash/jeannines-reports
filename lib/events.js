const SHORE_GUID     = 'bac64c98-94fa-43f8-928d-c4ef94e68e78';
const MONTECITO_GUID = '9876a700-dac3-4b89-b92d-ffb9ac247eee';
const GOLETA_GUID    = '87077240-4861-466d-9245-eedefdc6a862';

const LOCATION_TOWN = {
  [SHORE_GUID]:     'Santa Barbara',
  [MONTECITO_GUID]: 'Montecito',
  [GOLETA_GUID]:    'Goleta',
};

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

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

const NO_EVENT_PHRASES = [
  'no specific events', 'no events found', "i couldn't find", "i don't have",
  'no information', 'not aware of', 'unable to find', 'no upcoming events',
  'i cannot find', 'no major events', 'cannot provide', 'no details',
];

// Only events that genuinely bring crowds and affect restaurant traffic
const HIGH_TRAFFIC_KEYWORDS = [
  'graduation', 'commencement', 'world cup', 'super bowl', 'parade',
  'festival', 'fiesta', 'marathon', 'triathlon', 'championship', 'tournament',
  'solstice', 'sbiff', 'film festival', 'air show', 'taste of',
];

// Drop these even if they match — too small or wrong city
const LOW_TRAFFIC_EXCLUDES = [
  'volunteer', 'gardening', 'storytime', 'book club', 'workshop', 'class',
  'lecture', 'yoga', 'wellness', 'healing', 'single women', 'friendship manor',
  'wiggly', 'buellton', 'costa mesa', 'montclair', 'oroville', 'ventura',
  'lompoc', 'oxnard', 'thousand oaks',
];

const TOWN_VALIDATION_TERMS = {
  'Santa Barbara': ['santa barbara', 'state street', 'stearns wharf', 'funk zone', 'sb bowl', 'santa barbara bowl', 'ucsb', 'uc santa barbara'],
  'Montecito': ['montecito', 'coast village', 'santa barbara'],
  'Goleta': ['goleta', 'ucsb', 'isla vista', 'camino real', 'uc santa barbara'],
};

// Sentences to drop — noise about tickets, registration, info sources
const NOISE_SENTENCE = /\b(ticket|admission|register|registration|fee|cost|price|required for|please (visit|check|see|note)|for more information|note that|it is recommended|the exact time|subject to change|check the (website|official))\b/i;

function isHighTraffic(text) {
  const lower = text.toLowerCase();
  if (LOW_TRAFFIC_EXCLUDES.some(kw => lower.includes(kw))) return false;
  return HIGH_TRAFFIC_KEYWORDS.some(kw => lower.includes(kw));
}

function cleanAnswer(answer, town) {
  const terms = TOWN_VALIDATION_TERMS[town] || [town.toLowerCase()];
  if (!terms.some(t => answer.toLowerCase().includes(t))) return null;

  let cleaned = answer
    .replace(/^On\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4},?\s*/i, '')
    .trim();

  // Split into sentences, keep only the first one that mentions a high-traffic event
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const useful = sentences.filter(s => !NOISE_SENTENCE.test(s) && isHighTraffic(s));
  if (!useful.length) return null;
  cleaned = useful[0].trim();

  if (cleaned.length < 15) return null;
  if (cleaned.length > 160) cleaned = cleaned.slice(0, 157) + '…';
  return cleaned;
}

async function tavilySearch(query, town) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();

    const rawAnswer = (data.answer || '').trim();
    const answerLower = rawAnswer.toLowerCase();
    if (rawAnswer.length >= 15 && !NO_EVENT_PHRASES.some(p => answerLower.includes(p))) {
      const cleaned = cleanAnswer(rawAnswer, town);
      if (cleaned) return [cleaned];
    }

    const validTerms = TOWN_VALIDATION_TERMS[town] || [town.toLowerCase()];
    const results = [];
    for (const item of (data.results || [])) {
      const title = (item.title || '').replace(/\s*[|–—-]\s*.+$/, '').trim();
      if (!title || title.length < 8 || title.length > 70) continue;
      if (!isHighTraffic(title)) continue;
      const fullText = (title + ' ' + (item.content || '')).toLowerCase();
      if (!validTerms.some(t => fullText.includes(t))) continue;
      results.push(title);
    }
    return results.slice(0, 1);
  } catch {
    return [];
  }
}

async function fetchTownEventsForDate(dateStr, town) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];

  const humanDate = humanDateStr(dateStr);
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(5, 7);
  const isGradSeason = month === '05' || month === '06';

  const queries = [
    `major events graduation festival parade large crowds near ${town} California on ${humanDate}`,
  ];

  // Extra UCSB/graduation search for May-June, applied to SB and Goleta
  if (isGradSeason && (town === 'Santa Barbara' || town === 'Goleta')) {
    queries.push(`UCSB University California Santa Barbara commencement graduation ceremony ${year} ${humanDate}`);
  }

  const allResults = await Promise.all(queries.map(q => tavilySearch(q, town)));
  return [...new Set(allResults.flat())].slice(0, 2);
}

async function fetchTownEventDays(dateStr, town) {
  const [today, tomorrow, dayAfter] = await Promise.all([
    fetchTownEventsForDate(dateStr, town),
    fetchTownEventsForDate(addDays(dateStr, 1), town),
    fetchTownEventsForDate(addDays(dateStr, 2), town),
  ]);
  return { today, tomorrow, dayAfter };
}

function mergeDays(a, b) {
  return {
    today:    [...new Set([...a.today,    ...b.today   ])].slice(0, 3),
    tomorrow: [...new Set([...a.tomorrow, ...b.tomorrow])].slice(0, 3),
    dayAfter: [...new Set([...a.dayAfter, ...b.dayAfter])].slice(0, 3),
  };
}

export { addDays };

export async function fetchSpecialEvents(dateStr) {
  const [national, sbDays, montecitoDays, goletaDays] = await Promise.all([
    fetchNationalHolidays(dateStr),
    fetchTownEventDays(dateStr, 'Santa Barbara'),
    fetchTownEventDays(dateStr, 'Montecito'),
    fetchTownEventDays(dateStr, 'Goleta'),
  ]);

  const byLocation = {
    [SHORE_GUID]:     sbDays,
    [MONTECITO_GUID]: mergeDays(montecitoDays, sbDays),  // Montecito gets its own + SB events
    [GOLETA_GUID]:    goletaDays,
  };

  const hasAny = national.length
    || Object.values(byLocation).some(d => d.today.length || d.tomorrow.length || d.dayAfter.length);
  if (!hasAny) return null;
  return { national, byLocation };
}
