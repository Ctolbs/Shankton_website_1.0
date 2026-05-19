const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const {
    property_id, property_name, checkin, checkout,
    guests, first_name, last_name, email, phone,
    nights, price_cents, cleaning_fee_cents,
  } = body;

  if (!property_id || !checkin || !checkout || !email || !first_name || !last_name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.URL || 'https://www.shankton.com';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: property_name,
            description: `${nights} night${nights !== 1 ? 's' : ''} · Check-in ${checkin} · Check-out ${checkout} · ${guests} guest${guests > 1 ? 's' : ''}`,
          },
          unit_amount: price_cents,
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'Cleaning fee' },
          unit_amount: cleaning_fee_cents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${siteUrl}/booking-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/#nicaragua`,
    metadata: {
      property_id,
      property_name,
      checkin,
      checkout,
      guests: String(guests),
      first_name,
      last_name,
      email,
      phone: phone || '',
      nights: String(nights),
    },
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: session.url }),
  };
};
