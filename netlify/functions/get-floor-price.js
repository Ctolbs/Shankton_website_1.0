const { PROPERTIES } = require('./property-config');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const { property_id } = event.queryStringParameters || {};
  if (!property_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing property_id' }) };

  const cfg = PROPERTIES[property_id];
  if (!cfg) return { statusCode: 400, body: JSON.stringify({ error: 'Unknown property' }) };

  const token = process.env.HOSPITABLE_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'Server config error' }) };

  // Fetch next 45 days of calendar data
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 45);
  const fmt = d => d.toISOString().split('T')[0];

  const pricingId = cfg.pricingPropertyId || property_id;
  const url = `https://public.api.hospitable.com/v2/properties/${pricingId}/calendar?start_date=${fmt(start)}&end_date=${fmt(end)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Calendar API ${res.status}`);

    const data = await res.json();
    const isAvail = d => d.status?.available ?? d.available ?? true;
    const availDays = (data.data?.days || []).filter(d => isAvail(d) && d.price?.amount > 0);

    if (availDays.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
        body: JSON.stringify({ floor_cents: null }),
      };
    }

    const floorCents = Math.min(...availDays.map(d => d.price.amount));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // CDN caches for 1 hour
      },
      body: JSON.stringify({ floor_cents: floorCents, floor_dollars: floorCents / 100 }),
    };
  } catch (err) {
    console.error('get-floor-price error:', err.message);
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not fetch pricing' }) };
  }
};
