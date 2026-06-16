const API = 'https://public.api.hospitable.com/v2';
const { PROPERTIES } = require('./property-config');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const { property_id } = event.queryStringParameters || {};
  if (!property_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing property_id' }) };
  if (!PROPERTIES[property_id]) return { statusCode: 400, body: JSON.stringify({ error: 'Unknown property' }) };

  const token = process.env.HOSPITABLE_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'Server config error' }) };

  try {
    const res = await fetch(`${API}/properties/${property_id}/reviews?per_page=20&include=guest`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`API ${res.status}: ${txt.slice(0, 200)}`);
    }

    const { data: raw } = await res.json();

    const reviews = (raw || [])
      .filter(r => r.public.rating === 5 && r.public.review && r.public.review.length >= 60 && r.guest?.first_name)
      .slice(0, 4)
      .map(r => {
        const dt = new Date(r.reviewed_at);
        const lastName = r.guest.last_name;
        return {
          text:    r.public.review,
          author:  `${r.guest.first_name}${lastName ? ' ' + lastName[0] + '.' : ''}`,
          date:    dt.toLocaleString('en-US', { month: 'long' }) + ' ' + dt.getFullYear(),
          initial: r.guest.first_name[0].toUpperCase(),
        };
      });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=21600' },
      body: JSON.stringify({ reviews }),
    };
  } catch (err) {
    console.error('get-reviews error:', err.message);
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }
};
