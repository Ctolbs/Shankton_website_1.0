const { PROPERTIES } = require('./property-config');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const { property_id, pricing_id, checkin, checkout } = event.queryStringParameters || {};
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!property_id || !checkin || !checkout) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing parameters' }) };
  }
  if (!PROPERTIES[property_id]) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown property' }) };
  }
  if (!dateRe.test(checkin) || !dateRe.test(checkout) || checkin >= checkout) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid dates' }) };
  }

  const token = process.env.HOSPITABLE_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'Server config error' }) };

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const calUrl = id => `https://public.api.hospitable.com/v2/properties/${id}/calendar?start_date=${checkin}&end_date=${checkout}`;

  // Availability calendar — always use the actual property being booked
  const res = await fetch(calUrl(property_id), { headers });
  if (!res.ok) {
    const err = await res.text();
    console.error('Hospitable calendar error:', err);
    return { statusCode: res.status, body: JSON.stringify({ error: 'Calendar API error' }) };
  }

  const data = await res.json();
  const days = data.data?.days || [];
  console.log('Hospitable days sample:', JSON.stringify(days[0]));

  // Exclude the checkout day — only nights being slept need to be available
  const stayNights = days.filter(d => d.date !== checkout);

  // Pricing calendar — use a separate property when the booking property has
  // inflated platform rates (e.g. Airbnb markup). pricing_id should point to
  // the equivalent VRBO/direct listing so guests see the real direct rate.
  let priceDays = stayNights;
  if (pricing_id && pricing_id !== property_id) {
    const priceRes = await fetch(calUrl(pricing_id), { headers });
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      const allPriceDays = priceData.data?.days || [];
      priceDays = allPriceDays.filter(d => d.date !== checkout);
    }
  }

  if (stayNights.length === 0) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: false, reason: 'Invalid date range' }),
    };
  }

  // Support both flat (d.available) and nested (d.status.available) API shapes
  const isAvailable = d => d.status?.available ?? d.available ?? true;
  const unavailableDay = stayNights.find(d => !isAvailable(d));
  const checkinDay = stayNights[0];
  const minStay = checkinDay?.min_stay || 1;
  const nights = stayNights.length;

  if (unavailableDay) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: false, reason: `${unavailableDay.date} is not available` }),
    };
  }

  if (nights < minStay) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: false, reason: `Minimum stay is ${minStay} nights` }),
    };
  }

  // Sum per-night prices (in cents) — uses priceDays which may come from a
  // separate direct-rate property (see pricing_id above)
  const priceCents = priceDays.reduce((sum, d) => sum + d.price.amount, 0);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      available: true,
      nights,
      min_stay: minStay,
      price_cents: priceCents,
      price_dollars: priceCents / 100,
      nights_detail: stayNights.map(d => ({ date: d.date, amount: d.price.amount })),
    }),
  };
};
