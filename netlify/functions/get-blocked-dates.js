const { PROPERTIES } = require('./property-config');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const { property_id, year, month } = event.queryStringParameters || {};

  if (!property_id || !year || !month) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing parameters' }) };
  }
  if (!PROPERTIES[property_id]) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown property' }) };
  }

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid year/month' }) };
  }

  const token = process.env.HOSPITABLE_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'Server config error' }) };

  // Fetch the full requested month
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay   = new Date(y, m, 0).getDate();
  const endDate   = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

  const url = `https://public.api.hospitable.com/v2/properties/${property_id}/calendar?start_date=${startDate}&end_date=${endDate}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Hospitable API ${res.status}`);

    const data = await res.json();
    const isAvail = d => d.status?.available ?? d.available ?? true;
    const days = data.data?.days || [];

    const blocked = days.filter(d => !isAvail(d)).map(d => d.date);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // 5-min CDN cache
      },
      body: JSON.stringify({ blocked }),
    };
  } catch (err) {
    console.error('get-blocked-dates error:', err.message);
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not fetch calendar' }) };
  }
};
