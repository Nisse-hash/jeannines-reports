const LAT = 34.4208;
const LON = -119.6982;

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

export async function fetchWeather(dateStr) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&start_date=${dateStr}&end_date=${dateStr}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const d = json.daily;
    if (!d || !d.temperature_2m_max?.length) return null;
    const code = d.weathercode[0];
    const wmo = WMO[code] || { emoji: '🌡️', label: 'Unknown' };
    return {
      tempHighF:   Math.round(d.temperature_2m_max[0]),
      tempLowF:    Math.round(d.temperature_2m_min[0]),
      emoji:       wmo.emoji,
      description: wmo.label,
    };
  } catch {
    return null;
  }
}
