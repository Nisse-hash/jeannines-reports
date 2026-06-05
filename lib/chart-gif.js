// Generates a chart image via QuickChart.io — no native dependencies.
// Returns a PNG buffer, or null on failure (email falls back to text).

export async function generateChartGif(timeSeries) {
  if (!timeSeries || !timeSeries.labels.length) return null;

  const { labels, revenue, headcount } = timeSeries;
  const n = labels.length;

  // Active range only
  let first = 0, last = n - 1;
  for (let i = 0; i < n; i++) { if (revenue[i] > 0 || headcount[i] > 0) { first = i; break; } }
  for (let i = n - 1; i >= 0; i--) { if (revenue[i] > 0 || headcount[i] > 0) { last = i; break; } }

  // Show only whole-hour labels on X axis to avoid crowding
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

  // QuickChart requires the chart config as a JS-serialized string (not strict JSON)
  // so functions work. We don't use functions here, so JSON is fine.
  const chartStr = JSON.stringify(chartConfig);

  const payload = {
    backgroundColor: '#0A0A0F',
    width: 508,
    height: 185,
    devicePixelRatio: 1.5,
    format: 'png',
    chart: chartStr,
  };

  try {
    const res = await fetch('https://quickchart.io/chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('image')) {
      const buf = await res.arrayBuffer();
      console.log('  Chart image: generated via QuickChart (' + Math.round(buf.byteLength / 1024) + ' KB)');
      return Buffer.from(buf);
    }

    const errText = await res.text();
    throw new Error(`QuickChart ${res.status}: ${errText.slice(0, 200)}`);
  } catch (err) {
    console.warn('  Chart image failed:', err.message);
    return null;
  }
}
