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
const START_HOUR  = 7;
const END_HOUR    = 15; // inclusive

// Per-location coordinates and short address label
export const LOCATION_COORDS = {
  'bac64c98-94fa-43f8-928d-c4ef94e68e78': { lat: 34.4122,  lon: -119.6896, addr: '1 State St' },
  '9876a700-dac3-4b89-b92d-ffb9ac247eee': { lat: 34.4278,  lon: -119.6472, addr: '1263 Coast Village Rd' },
  '87077240-4861-466d-9245-eedefdc6a862': { lat: 34.4384,  lon: -119.8268, addr: '7060 Hollister Ave' },
};

// Accepts optional lat/lon/addr — defaults to At the Shore
export async function fetchWeather(dateStr, lat = 34.4122, lon = -119.6896, addr = '1 State St') {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=weathercode,temperature_2m&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&start_date=${dateStr}&end_date=${dateStr}`;
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
        label: HOUR_LABELS[hr - START_HOUR],
        emoji: wmo.emoji,
        desc:  wmo.label,
        tempF: Math.round(h.temperature_2m[hr]),
      });
    }
    return { hourly, addr };
  } catch {
    return null;
  }
}
