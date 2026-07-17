const Stripe = require('stripe');
const { PROPERTIES } = require('./property-config');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const {
    property_id, cancel_path, checkin, checkout,
    guests, first_name, last_name, email, phone, nights,
    pet_fee_cents: clientPetFee,
  } = body;

  if (!property_id || !checkin || !checkout || !email || !first_name || !last_name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Validate date format/order before they touch the calendar URL
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(checkin) || !dateRe.test(checkout) || checkin >= checkout) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid dates' }) };
  }

  // Prevent open redirect — cancel_path must be a relative path on this site
  const safeCancelPath = (cancel_path && /^\/[^/]/.test(cancel_path)) ? cancel_path : '/';

  // Reject unknown properties
  const cfg = PROPERTIES[property_id];
  if (!cfg) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown property' }) };
  }

  // Re-verify availability AND price server-side against Hospitable — never trust the client.
  const token = process.env.HOSPITABLE_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const calUrl = id => `https://public.api.hospitable.com/v2/properties/${id}/calendar?start_date=${checkin}&end_date=${checkout}`;
  const pricingId = cfg.pricingPropertyId || property_id;

  let priceCents;
  try {
    // Availability: always the actual property being booked
    const availRes = await fetch(calUrl(property_id), { headers });
    if (!availRes.ok) throw new Error(`Calendar API ${availRes.status}`);
    const availData = await availRes.json();
    const stayNights = (availData.data?.days || []).filter(d => d.date !== checkout);
    if (stayNights.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid date range' }) };
    }

    // Reject unavailable dates or below-minimum stays — mirrors check-availability
    const isAvailable = d => d.status?.available ?? d.available ?? true;
    const unavailableDay = stayNights.find(d => !isAvailable(d));
    if (unavailableDay) {
      return { statusCode: 409, body: JSON.stringify({ error: `${unavailableDay.date} is not available` }) };
    }
    const minStay = stayNights[0]?.min_stay || 1;
    if (stayNights.length < minStay) {
      return { statusCode: 409, body: JSON.stringify({ error: `Minimum stay is ${minStay} nights` }) };
    }

    // Price: from the pricing property (reuse the availability calendar when they're the same)
    let priceDays = stayNights;
    if (pricingId !== property_id) {
      const priceRes = await fetch(calUrl(pricingId), { headers });
      if (!priceRes.ok) throw new Error(`Pricing calendar ${priceRes.status}`);
      const priceData = await priceRes.json();
      priceDays = (priceData.data?.days || []).filter(d => d.date !== checkout);
    }
    priceCents = priceDays.reduce((sum, d) => sum + d.price.amount, 0);
  } catch (err) {
    console.error('Availability/price fetch error:', err.message);
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not verify availability' }) };
  }

  // Calculate all fees server-side
  const cleaningCents = cfg.cleaningFee;
  const petCents      = (clientPetFee > 0 && cfg.petFee) ? cfg.petFee : 0;
  const subtotalCents = priceCents + cleaningCents + petCents;
  const taxCents      = cfg.taxRate ? Math.round(subtotalCents * cfg.taxRate / 100) : 0;

  const stripe  = Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.URL || 'https://www.shankton.com';

  const nightCount = parseInt(nights, 10) || 1;

  const lineItems = [
    {
      price_data: {
        currency: 'usd',
        product_data: {
          name: cfg.name,
          description: `${nightCount} night${nightCount !== 1 ? 's' : ''} · Check-in ${checkin} · Check-out ${checkout} · ${guests} guest${guests > 1 ? 's' : ''}`,
        },
        unit_amount: priceCents,
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: 'usd',
        product_data: { name: 'Cleaning fee' },
        unit_amount: cleaningCents,
      },
      quantity: 1,
    },
  ];

  if (petCents > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Pet fee' },
        unit_amount: petCents,
      },
      quantity: 1,
    });
  }

  if (taxCents > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: cfg.taxLabel || 'Taxes & fees' },
        unit_amount: taxCents,
      },
      quantity: 1,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      line_items: lineItems,
      mode: 'payment',
      success_url: `${siteUrl}/booking-success.html?session_id={CHECKOUT_SESSION_ID}&property=${encodeURIComponent(cfg.name)}&checkin=${checkin}&checkout=${checkout}&nights=${nightCount}&guests=${guests}`,
      cancel_url:  `${siteUrl}${safeCancelPath}`,
      metadata: {
        property_id,
        property_name:      cfg.name,
        checkin,
        checkout,
        guests:             String(guests),
        first_name,
        last_name,
        email,
        phone:              phone || '',
        nights:             String(nightCount),
        price_cents:        String(priceCents),
        cleaning_fee_cents: String(cleaningCents),
        pet_fee_cents:      String(petCents),
        tax_cents:          String(taxCents),
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Stripe error:', err.message);
    return { statusCode: 502, body: JSON.stringify({ error: 'Payment setup failed' }) };
  }
};
