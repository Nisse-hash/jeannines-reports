export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    token:   process.env.AIRTABLE_API_KEY              || '',
    baseId:  process.env.JEANNINES_AIRTABLE_BASE_ID    || '',
    tableId: process.env.JEANNINES_AIRTABLE_TABLE_ID   || '',
  });
}
