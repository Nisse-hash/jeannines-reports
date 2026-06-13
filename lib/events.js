// Town name for each location GUID — used to build Tavily search queries
const LOCATION_TOWN = {
  'bac64c98-94fa-43f8-928d-c4ef94e68e78': 'Santa Barbara',
  '9876a700-dac3-4b89-b92d-ffb9ac247eee': 'Montecito',
  '87077240-4861-466d-9245-eedefdc6a862': 'Goleta',
};

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
  'i cannot find', 'no major events',
];

const FALLBACK_EVENT_KEYWORDS = [
  'graduation', 'commencement', 'festival', 'parade', 'fair', 'concert',
  'ceremony', 'fiesta', 'market', 'race', 'tournament', 'celebration',
  'performance', 'show', 'exhibit', 'expo', 'gala', 'run', 'walk', 'marathon',
];

// At least one of these must appear in the Tavily answer, or the answer is from the wrong city
const TOWN_VALIDATION_TERMS = {
  'Santa Barbara': ['santa barbara', 'state street', 'stearns wharf', 'funk zone', 'sb bowl', 'santa barbara bowl'],
  'Montecito': ['montecito', 'coast village', 'santa barbara'],
  'Goleta': ['goleta', 'ucsb', 'isla vista', 'camino real'],
};

// Generic trailing sentences Tavily adds that aren't useful
const TRAILING_GARBAGE = /\.\s*(The exact time and location[^.]*|For more information[^.]*|Please check[^.]*|It is recommended[^.]*|Note that[^.]*)\.?$/i;

function cleanAnswer(answer, town) {
  // Must reference the correct city
  const terms = TOWN_VALIDATION_TERMS[town] || [town.toLowerCase()];
  if (!terms.some(t => answer.toLowerCase().includes(t))) return null;

  // Strip trailing generic sentences
  let cleaned = answer.replace(TRAILING_GARBAGE, '').trim();

  // Take only the first 2 sentences to keep it tight
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  cleaned = sentences.slice(0, 2).join(' ').trim();

  if (cleaned.length < 15) return null;
  // Cap at 200 chars for email display
  if (cleaned.length > 200) cleaned = cleaned.slice(0, 197) + '…';
  return cleaned;
}

async function fetchTownEvents(dateStr, town) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const humanDate = humanDateStr(dateStr);
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: `events and activities happening in ${town} California on ${humanDate}`,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();

    // Prefer the AI answer — clean, natural-language summary
    const rawAnswer = (data.answer || '').trim();
    const answerLower = rawAnswer.toLowerCase();
    if (rawAnswer.length >= 15 && !NO_EVENT_PHRASES.some(p => answerLower.includes(p))) {
      const cleaned = cleanAnswer(rawAnswer, town);
      if (cleaned) return [cleaned];
    }

    // Fall back to filtering result titles — must mention the correct town
    const validTerms = TOWN_VALIDATION_TERMS[town] || [town.toLowerCase()];
    const results = [];
    for (const item of (data.results || [])) {
      const title = (item.title || '').replace(/\s*[|–—-]\s*.+$/, '').trim();
      if (!title || title.length < 8 || title.length > 70) continue;
      const titleLower = title.toLowerCase();
      if (!FALLBACK_EVENT_KEYWORDS.some(kw => titleLower.includes(kw))) continue;
      if (/things to do|what to do|events? in california|events? calendar|guide to/i.test(title)) continue;
      const fullText = (title + ' ' + (item.content || '')).toLowerCase();
      if (!validTerms.some(t => fullText.includes(t))) continue;
      results.push(title);
    }
    return results.slice(0, 2);
  } catch {
    return [];
  }
}

export async function fetchSpecialEvents(dateStr) {
  const guids = Object.keys(LOCATION_TOWN);

  const [national, ...townResults] = await Promise.all([
    fetchNationalHolidays(dateStr),
    ...guids.map(guid => fetchTownEvents(dateStr, LOCATION_TOWN[guid])),
  ]);

  const byLocation = Object.fromEntries(guids.map((guid, i) => [guid, townResults[i]]));
  const hasAny = national.length || guids.some(g => byLocation[g].length);
  if (!hasAny) return null;
  return { national, byLocation };
}
