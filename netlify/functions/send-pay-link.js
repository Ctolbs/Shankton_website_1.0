const Stripe = require('stripe');
const { PROPERTIES } = require('./property-config');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { property_id, checkin, checkout, guests, amount_cents, first_name, last_name, email, phone, note } = body;

  if (!property_id || !checkin || !checkout || !email || !first_name || !last_name || !amount_cents) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const cfg = PROPERTIES[property_id];
  if (!cfg) return { statusCode: 400, body: JSON.stringify({ error: 'Unknown property' }) };

  const nights = Math.round(
    (new Date(checkout + 'T12:00:00') - new Date(checkin + 'T12:00:00')) / (1000 * 60 * 60 * 24)
  );
  if (nights < 1) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid dates' }) };

  const stripe  = Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.URL || 'https://www.shankton.com';
  const guestCount = parseInt(guests, 10) || 1;
  const totalCents = parseInt(amount_cents, 10);

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: cfg.name,
            description: `${nights} night${nights !== 1 ? 's' : ''} · ${checkin} → ${checkout} · ${guestCount} guest${guestCount !== 1 ? 's' : ''}`,
          },
          unit_amount: totalCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${siteUrl}/booking-success.html?session_id={CHECKOUT_SESSION_ID}&property=${encodeURIComponent(cfg.name)}&checkin=${checkin}&checkout=${checkout}&nights=${nights}&guests=${guestCount}`,
      cancel_url: `${siteUrl}/`,
      metadata: {
        property_id,
        property_name:      cfg.name,
        checkin,
        checkout,
        guests:             String(guestCount),
        first_name,
        last_name,
        email,
        phone:              phone || '',
        nights:             String(nights),
        price_cents:        String(totalCents),
        cleaning_fee_cents: '0',
        pet_fee_cents:      '0',
        tax_cents:          '0',
      },
    });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return { statusCode: 502, body: JSON.stringify({ error: 'Payment setup failed' }) };
  }

  // Send payment request email to guest
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    await sendPaymentEmail({
      first_name, last_name, email,
      property_name: cfg.name,
      checkin, checkout, nights, guests: guestCount,
      amount_cents: totalCents,
      note,
      payment_url: session.url,
    });
  }

  console.log(`Pay link sent: ${email} · ${cfg.name} · ${checkin}→${checkout} · $${(totalCents/100).toFixed(2)}`);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: session.url }),
  };
};

async function sendPaymentEmail(d) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const fmt = cents => '$' + (cents / 100).toFixed(2);

  const dateParts = s => {
    const [y, m, day] = s.split('-');
    const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
    return {
      weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
      month:   dt.toLocaleDateString('en-US', { month: 'short' }),
      day:     parseInt(day),
      year:    y,
    };
  };

  const ci = dateParts(d.checkin);
  const co = dateParts(d.checkout);

  const noteBlock = d.note ? `
    <tr><td style="background:#ffffff;padding:0 40px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid #1A332F;padding-left:16px;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#aaa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Note from host</p>
          <p style="margin:0;font-size:14px;color:#444;line-height:1.7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${d.note}</p>
        </td></tr>
      </table>
    </td></tr>` : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#edeae2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#edeae2;">
<tr><td align="center" style="padding:36px 16px 48px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

  <tr><td style="background:#1A332F;border-radius:6px 6px 0 0;padding:36px 40px;">
    <a href="https://www.shankton.com" style="display:block;margin-bottom:24px;text-decoration:none;">
      <img src="https://www.shankton.com/logo-preview.svg" alt="Shankton Properties" width="120" style="display:block;width:120px;height:auto;">
    </a>
    <h1 style="margin:0 0 6px;color:#f5f1e8;font-size:28px;font-weight:700;letter-spacing:-0.5px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${d.property_name}</h1>
    <p style="margin:0;color:rgba(245,241,232,0.7);font-size:16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Your reservation is ready — complete payment to confirm.</p>
  </td></tr>

  <tr><td style="background:#ffffff;padding:32px 40px 0;">
    <p style="margin:0 0 28px;font-size:16px;color:#444;line-height:1.7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Hi ${d.first_name}, your stay has been reserved. Complete payment below to lock in your dates.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr>
        <td width="47%" style="background:#f5f1e8;border-radius:4px;padding:22px 20px 18px;border-top:3px solid #1A332F;">
          <p style="margin:0 0 8px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#999;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Check-in</p>
          <p style="margin:0;font-size:36px;font-weight:800;color:#1A332F;line-height:1;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${ci.day}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#666;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${ci.weekday} · ${ci.month} ${ci.year}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#aaa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">After 4:00 PM</p>
        </td>
        <td width="6%" align="center" style="color:#ccc;font-size:18px;vertical-align:middle;">→</td>
        <td width="47%" style="background:#f5f1e8;border-radius:4px;padding:22px 20px 18px;border-top:3px solid #c8c4bc;">
          <p style="margin:0 0 8px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#999;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Check-out</p>
          <p style="margin:0;font-size:36px;font-weight:800;color:#444;line-height:1;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${co.day}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#666;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${co.weekday} · ${co.month} ${co.year}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#aaa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Before 11:00 AM</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e4dc;border-radius:4px;margin-bottom:32px;">
      <tr>
        <td align="center" style="padding:16px 12px;border-right:1px solid #e8e4dc;">
          <p style="margin:0 0 3px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#bbb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Guests</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#1A332F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${d.guests}</p>
        </td>
        <td align="center" style="padding:16px 12px;border-right:1px solid #e8e4dc;">
          <p style="margin:0 0 3px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#bbb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Nights</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#1A332F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${d.nights}</p>
        </td>
        <td align="center" style="padding:16px 12px;">
          <p style="margin:0 0 3px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#bbb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Total</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#1A332F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${fmt(d.amount_cents)}</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
      <tr><td align="center">
        <a href="${d.payment_url}" style="display:block;background:#1A332F;color:#f5f1e8;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:1px;padding:18px 32px;border-radius:4px;text-align:center;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Pay ${fmt(d.amount_cents)} · Complete Booking →</a>
      </td></tr>
      <tr><td align="center" style="padding-top:10px;">
        <p style="margin:0;font-size:12px;color:#aaa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">🔒 Secured by Stripe · Link expires in 24 hours</p>
      </td></tr>
    </table>
  </td></tr>

  ${noteBlock}

  <tr><td style="background:#1A332F;padding:28px 40px;">
    <p style="margin:0 0 6px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(245,241,232,0.4);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">After payment</p>
    <p style="margin:0;font-size:13px;color:rgba(245,241,232,0.7);line-height:1.7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">You'll receive a booking confirmation email instantly. Check-in instructions arrive 48 hours before your stay.</p>
  </td></tr>

  <tr><td style="background:#f0ede5;border-radius:0 0 6px 6px;padding:24px 40px;">
    <p style="margin:0;font-size:12px;color:#aaa;line-height:2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      Shankton Properties · <a href="https://www.shankton.com" style="color:#aaa;text-decoration:none;">shankton.com</a> · <a href="https://www.shankton.com/terms.html" style="color:#aaa;text-decoration:none;">Terms &amp; Conditions</a><br>
      Questions? Email <a href="mailto:contact@shankton.com" style="color:#888;text-decoration:none;">contact@shankton.com</a><br>
      Nicaragua: Nemer <a href="https://wa.me/50558112744" style="color:#888;text-decoration:none;">+505 5811 2744</a> (WhatsApp) &nbsp;·&nbsp; California: Jasmin <a href="tel:+17147376193" style="color:#888;text-decoration:none;">+1 714 737 6193</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:     'Shankton Properties <contact@shankton.com>',
        to:       `${d.first_name} ${d.last_name} <${d.email}>`,
        reply_to: 'contact@shankton.com',
        subject:  `Your reservation · ${d.property_name} · Complete payment to confirm`,
        html,
      }),
    });
    if (res.ok) {
      console.log('Payment email sent to', d.email);
    } else {
      console.error('Resend error:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Payment email failed:', err.message);
  }
}
