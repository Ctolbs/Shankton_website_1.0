const MCP_URL = 'https://mcp.hospitable.com/mcp';

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const { property_id } = event.queryStringParameters || {};
  if (!property_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing property_id' }) };

  const token = process.env.HOSPITABLE_MCP_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'Server config error' }) };

  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'get-property-reviews', arguments: { uuid: property_id, per_page: 20, include: 'guest' } },
      }),
    });

    const d = await res.json();
    const raw = JSON.parse(d.result.content[0].text).data || [];

    const reviews = raw
      .filter(r => r.public.rating === 5 && r.public.review && r.public.review.length >= 60 && r.guest?.first_name)
      .slice(0, 4)
      .map(r => {
        const dt = new Date(r.reviewed_at);
        const month = dt.toLocaleString('en-US', { month: 'long' });
        const lastName = r.guest.last_name;
        return {
          text:    r.public.review,
          author:  `${r.guest.first_name}${lastName ? ' ' + lastName[0] + '.' : ''}`,
          date:    `${month} ${dt.getFullYear()}`,
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
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not fetch reviews' }) };
  }
};
