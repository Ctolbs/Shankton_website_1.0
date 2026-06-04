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

  let res, result;
  try {
    res = await fetch('https://public.api.hospitable.com/v2/reservations', {
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
        reservation_code: session.id.slice(0, 50),
        guest: {
          first_name,
          last_name,
          email,
          phone: phone || undefined,
        },
        financials: {
          currency:           'USD',
          accommodation:      parseInt(price_cents        || '0', 10),
          cleaning_fee:       parseInt(cleaning_fee_cents || '0', 10),
          pet_fee:            parseInt(pet_fee_cents      || '0', 10),
          pass_through_taxes: parseInt(tax_cents          || '0', 10),
        },
      }),
    });
    result = await res.json();
  } catch (err) {
    console.error('HOSPITABLE FETCH FAILED — manual action required');
    console.error('Stripe session:', session.id, 'Guest:', email, 'Dates:', checkin, '→', checkout);
    console.error('Network error:', err.message);
    return { statusCode: 200, body: 'OK' };
  }

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

  // Send guest confirmation email via Resend
  await sendConfirmationEmail({ first_name, last_name, email, property_name, checkin, checkout, nights, guests,
    price_cents, cleaning_fee_cents, pet_fee_cents, tax_cents });

  return { statusCode: 200, body: 'OK' };
};

async function sendConfirmationEmail(d) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) { console.warn('RESEND_API_KEY not set — skipping confirmation email'); return; }

  const fmt = cents => '$' + (parseInt(cents || '0', 10) / 100).toFixed(2);
  const fmtDate = s => {
    const [y, m, day] = s.split('-');
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const petRow = parseInt(d.pet_fee_cents || '0') > 0
    ? `<tr><td style="padding:6px 0;color:#555;">Pet fee</td><td style="padding:6px 0;text-align:right;">${fmt(d.pet_fee_cents)}</td></tr>`
    : '';
  const taxRow = parseInt(d.tax_cents || '0') > 0
    ? `<tr><td style="padding:6px 0;color:#555;">Taxes &amp; fees</td><td style="padding:6px 0;text-align:right;">${fmt(d.tax_cents)}</td></tr>`
    : '';
  const total = parseInt(d.price_cents||0) + parseInt(d.cleaning_fee_cents||0) + parseInt(d.pet_fee_cents||0) + parseInt(d.tax_cents||0);

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f1e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;max-width:560px;width:100%;">

  <tr><td style="background:#1A332F;padding:32px 40px;">
    <p style="margin:0;color:rgba(245,241,232,0.6);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Shankton Properties</p>
    <h1 style="margin:12px 0 0;color:#f5f1e8;font-size:26px;font-weight:600;">You're confirmed.</h1>
  </td></tr>

  <tr><td style="padding:32px 40px 0;">
    <p style="margin:0 0 24px;font-size:16px;color:#333;line-height:1.6;">Hi ${d.first_name}, your booking is confirmed. Here's everything you need.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4dc;border-radius:4px;overflow:hidden;margin-bottom:28px;">
      <tr><td style="background:#f5f1e8;padding:16px 20px;">
        <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;">Your stay</p>
        <p style="margin:8px 0 0;font-size:20px;font-weight:600;color:#1A332F;">${d.property_name}</p>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:50%;padding-bottom:12px;">
              <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#999;">Check-in</p>
              <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#222;">${fmtDate(d.checkin)}</p>
            </td>
            <td style="width:50%;padding-bottom:12px;">
              <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#999;">Check-out</p>
              <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#222;">${fmtDate(d.checkout)}</p>
            </td>
          </tr>
          <tr>
            <td>
              <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#999;">Guests</p>
              <p style="margin:4px 0 0;font-size:15px;color:#222;">${d.guests} guest${parseInt(d.guests) !== 1 ? 's' : ''}</p>
            </td>
            <td>
              <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#999;">Duration</p>
              <p style="margin:4px 0 0;font-size:15px;color:#222;">${d.nights} night${parseInt(d.nights) !== 1 ? 's' : ''}</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 12px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#999;">Payment summary</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e4dc;margin-bottom:28px;">
      <tr><td style="padding:6px 0;color:#555;">Accommodation (${d.nights} night${parseInt(d.nights)!==1?'s':''})</td><td style="padding:6px 0;text-align:right;">${fmt(d.price_cents)}</td></tr>
      <tr><td style="padding:6px 0;color:#555;">Cleaning fee</td><td style="padding:6px 0;text-align:right;">${fmt(d.cleaning_fee_cents)}</td></tr>
      ${petRow}
      ${taxRow}
      <tr style="border-top:1px solid #e8e4dc;"><td style="padding:12px 0 6px;font-weight:700;color:#1A332F;">Total charged</td><td style="padding:12px 0 6px;text-align:right;font-weight:700;color:#1A332F;">${fmt(total)}</td></tr>
    </table>

    <p style="margin:0 0 28px;font-size:14px;color:#666;line-height:1.7;">You'll receive check-in instructions closer to your arrival date. In the meantime, reply to this email or write to <a href="mailto:contact@shankton.com" style="color:#2A6E5E;">contact@shankton.com</a> with any questions.</p>
  </td></tr>

  <tr><td style="padding:0 40px 32px;">
    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid #e8e4dc;font-size:12px;color:#aaa;line-height:1.6;">
      Shankton Properties · <a href="https://www.shankton.com" style="color:#aaa;">shankton.com</a><br>
      To cancel or modify your reservation, email <a href="mailto:contact@shankton.com" style="color:#aaa;">contact@shankton.com</a>.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Shankton Properties <confirm@shankton.com>',
        to: `${d.first_name} ${d.last_name} <${d.email}>`,
        reply_to: 'contact@shankton.com',
        subject: `Booking confirmed · ${d.property_name} · ${fmtDate(d.checkin)}`,
        html,
      }),
    });
    if (emailRes.ok) {
      console.log('Confirmation email sent to', d.email);
    } else {
      const body = await emailRes.text();
      console.error('Resend error:', emailRes.status, body);
    }
  } catch (err) {
    console.error('Confirmation email failed:', err.message);
  }
}
