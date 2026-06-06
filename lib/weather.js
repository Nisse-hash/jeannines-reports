// 3607 State Street, Santa Barbara, CA 93105
const LAT = 34.4402;
const LON = -119.7405;

const WMO = {
  0:  { emoji: '☀️',  label: 'Clear' },
  1:  { emoji: '🌤️', label: 'Mostly Clear' },
  2:  { emoji: '🌥️', label: 'Partly Cloudy' },
  3:  { emoji: '☁️',  label: 'Overcast' },
  45: { emoji: '🌫️', label: 'Foggy' },
  48: { emoji: '🌫️', label: 'Foggy' },
  51: { emoji: '🌦️', label: 'Light Drizzle' },
  53: { emoji: '🌦️', label: 'Drizzle' },
  55: { emoji: '🌧️', label: 'Heavy Drizzle' },
  56: { emoji: '🌦️', label: 'Freezing Drizzle' },
  57: { emoji: '🌧️', label: 'Freezing Drizzle' },
  61: { emoji: '🌧️', label: 'Light Rain' },
  63: { emoji: '🌧️', label: 'Rain' },
  65: { emoji: '🌧️', label: 'Heavy Rain' },
  71: { emoji: '❄️',  label: 'Light Snow' },
  73: { emoji: '❄️',  label: 'Snow' },
  75: { emoji: '❄️',  label: 'Heavy Snow' },
  77: { emoji: '🌨️', label: 'Snow Grains' },
  80: { emoji: '🌦️', label: 'Light Showers' },
  81: { emoji: '🌧️', label: 'Showers' },
  82: { emoji: '⛈️',  label: 'Heavy Showers' },
  85: { emoji: '🌨️', label: 'Snow Showers' },
  86: { emoji: '🌨️', label: 'Heavy Snow Showers' },
  95: { emoji: '⛈️',  label: 'Thunderstorm' },
  96: { emoji: '⛈️',  label: 'Thunderstorm w/ Hail' },
  99: { emoji: '⛈️',  label: 'Thunderstorm w/ Hail' },
};

const HOUR_LABELS = ['7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm'];
const START_HOUR = 7;
const END_HOUR   = 15; // inclusive

export async function fetchWeather(dateStr) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=weathercode,temperature_2m&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&start_date=${dateStr}&end_date=${dateStr}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const h = json.hourly;
    if (!h?.weathercode?.length) return null;

    const hourly = [];
    for (let hr = START_HOUR; hr <= END_HOUR; hr++) {
      const code = h.weathercode[hr];
      const wmo  = WMO[code] ?? { emoji: '🌡️', label: 'Unknown' };
      hourly.push({
        label:  HOUR_LABELS[hr - START_HOUR],
        emoji:  wmo.emoji,
        desc:   wmo.label,
        tempF:  Math.round(h.temperature_2m[hr]),
      });
    }
    return { hourly };
  } catch {
    return null;
  }
}
