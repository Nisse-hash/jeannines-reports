// Generates a hosted chart URL via QuickChart.io — no native dependencies.
// Returns a stable short URL string, or null on failure.

export async function generateChartGif(timeSeries) {
  if (!timeSeries || !timeSeries.labels.length) return null;

  const { labels, revenue, headcount } = timeSeries;
  const n = labels.length;

  // Active range only
  let first = 0, last = n - 1;
  for (let i = 0; i < n; i++) { if (revenue[i] > 0 || headcount[i] > 0) { first = i; break; } }
  for (let i = n - 1; i >= 0; i--) { if (revenue[i] > 0 || headcount[i] > 0) { last = i; break; } }

  const slicedLabels  = labels.slice(first, last + 1).map(l => l.includes(':') ? '' : l);
  const slicedRevenue = revenue.slice(first, last + 1);
  const slicedPeople  = headcount.slice(first, last + 1);

  const chartConfig = {
    type: 'bar',
    data: {
      labels: slicedLabels,
      datasets: [
        {
          type: 'line',
          label: 'Staff on floor',
          data: slicedPeople,
          borderColor: '#4ECDC4',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'y1',
          order: 1,
        },
        {
          type: 'bar',
          label: 'Revenue ($)',
          data: slicedRevenue,
          backgroundColor: 'rgba(201,168,76,0.7)',
          borderWidth: 0,
          yAxisID: 'y0',
          order: 2,
        },
      ],
    },
    options: {
      animation: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#999999', font: { size: 10 }, boxWidth: 12 },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#666666', font: { size: 9 }, maxRotation: 0 },
        },
        y0: {
          position: 'left',
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#C9A84C', font: { size: 9 } },
        },
        y1: {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#4ECDC4', font: { size: 9 } },
        },
      },
    },
  };

  try {
    const res = await fetch('https://quickchart.io/chart/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backgroundColor: '#0A0A0F',
        width: 508,
        height: 185,
        devicePixelRatio: 1.5,
        format: 'png',
        chart: JSON.stringify(chartConfig),
      }),
    });

    if (!res.ok) throw new Error(`QuickChart create ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.url) throw new Error('No URL in response');
    console.log('  Chart image: ' + json.url);
    return json.url;
  } catch (err) {
    console.warn('  Chart image failed:', err.message);
    return null;
  }
}
