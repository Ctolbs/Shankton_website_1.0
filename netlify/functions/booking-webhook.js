const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'OK' };
  }

  const session = stripeEvent.data.object;
  const {
    property_id, property_name,
    checkin, checkout, guests,
    first_name, last_name, email, phone, nights,
    price_cents, cleaning_fee_cents, pet_fee_cents, tax_cents,
  } = session.metadata;

  console.log(`Booking paid: ${email} · ${property_name} · ${checkin}→${checkout}`);

  const res = await fetch('https://public.api.hospitable.com/v2/reservations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HOSPITABLE_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      property_id,
      check_in:  checkin,
      check_out: checkout,
      guests:    { adults: parseInt(guests, 10) },
      language:  'en',
      channel:   'direct',
      reservation_code: session.id,
      guest: {
        first_name,
        last_name,
        email,
        phone: phone || undefined,
      },
      financials: {
        currency:          'USD',
        accommodation:     parseInt(price_cents        || '0', 10),
        cleaning_fee:      parseInt(cleaning_fee_cents || '0', 10),
        pet_fee:           parseInt(pet_fee_cents      || '0', 10),
        pass_through_taxes: parseInt(tax_cents         || '0', 10),
      },
    }),
  });

  const result = await res.json();

  if (!res.ok) {
    console.error('HOSPITABLE RESERVATION FAILED — manual action required');
    console.error('Stripe session:', session.id);
    console.error('Guest:', email, first_name, last_name);
    console.error('Dates:', checkin, '→', checkout, `(${nights} nights)`);
    console.error('Property:', property_id, property_name);
    console.error('Hospitable error:', JSON.stringify(result));
  } else {
    console.log('Hospitable reservation created:', JSON.stringify(result));
  }

  return { statusCode: 200, body: 'OK' };
};
