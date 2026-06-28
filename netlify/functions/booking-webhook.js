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

  let res, result, reservationOk = false;
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
    reservationOk = res.ok;
  } catch (err) {
    console.error('HOSPITABLE FETCH FAILED — manual action required');
    console.error('Network error:', err.message);
  }

  if (reservationOk) {
    console.log('Hospitable reservation created:', JSON.stringify(result));
    // Guest confirmation only goes out once the reservation actually exists.
    await sendConfirmationEmail({ first_name, last_name, email, property_name, checkin, checkout, nights, guests,
      price_cents, cleaning_fee_cents, pet_fee_cents, tax_cents, session_id: session.id });
  } else {
    // Card was charged but no reservation was created. Do NOT send a "confirmed"
    // email — alert ops to create the reservation manually and follow up with the guest.
    console.error('HOSPITABLE RESERVATION FAILED — manual action required');
    console.error('Stripe session:', session.id);
    console.error('Guest:', email, first_name, last_name);
    console.error('Dates:', checkin, '→', checkout, `(${nights} nights)`);
    console.error('Property:', property_id, property_name);
    console.error('Hospitable error:', JSON.stringify(result || {}));
    await sendOpsAlert({ first_name, last_name, email, phone, property_name, property_id,
      checkin, checkout, nights, guests, price_cents, cleaning_fee_cents, pet_fee_cents, tax_cents,
      session_id: session.id, error: result });
  }

  return { statusCode: 200, body: 'OK' };
};

// Charged-but-no-reservation alert to ops, so the team can create it manually.
async function sendOpsAlert(d) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) { console.warn('RESEND_API_KEY not set — skipping ops alert'); return; }
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = cents => '$' + (parseInt(cents || '0', 10) / 100).toFixed(2);
  const total = parseInt(d.price_cents||0) + parseInt(d.cleaning_fee_cents||0) + parseInt(d.pet_fee_cents||0) + parseInt(d.tax_cents||0);
  const ref = 'SH-' + (d.session_id || '').replace(/^cs_(test_|live_)/, '').slice(0, 8).toUpperCase();
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;">
    <h2 style="color:#b94040;margin:0 0 8px;">⚠️ Paid booking — reservation NOT created</h2>
    <p>A guest was <strong>charged via Stripe</strong> but the Hospitable reservation failed. Create it manually in Hospitable and confirm with the guest.</p>
    <table cellpadding="4" style="border-collapse:collapse;">
      <tr><td><strong>Booking ref</strong></td><td>${esc(ref)}</td></tr>
      <tr><td><strong>Stripe session</strong></td><td>${esc(d.session_id)}</td></tr>
      <tr><td><strong>Property</strong></td><td>${esc(d.property_name)} (${esc(d.property_id)})</td></tr>
      <tr><td><strong>Guest</strong></td><td>${esc(d.first_name)} ${esc(d.last_name)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${esc(d.email)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${esc(d.phone) || '—'}</td></tr>
      <tr><td><strong>Dates</strong></td><td>${esc(d.checkin)} → ${esc(d.checkout)} (${esc(d.nights)} nights, ${esc(d.guests)} guests)</td></tr>
      <tr><td><strong>Total charged</strong></td><td>${fmt(total)}</td></tr>
    </table>
    <p style="margin-top:12px;"><strong>Hospitable error:</strong></p>
    <pre style="background:#f5f5f5;padding:10px;border-radius:4px;white-space:pre-wrap;font-size:12px;">${esc(JSON.stringify(d.error || {}, null, 2))}</pre>
  </div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Shankton Booking System <contact@shankton.com>',
        to: 'contact@shankton.com',
        reply_to: d.email,
        subject: `⚠️ ACTION NEEDED — paid but no reservation · ${d.property_name} · ${d.checkin}`,
        html,
      }),
    });
    if (!r.ok) console.error('Ops alert Resend error:', r.status, await r.text());
    else console.log('Ops alert sent for failed reservation', d.session_id);
  } catch (err) {
    console.error('Ops alert failed:', err.message);
  }
}

async function sendConfirmationEmail(d) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) { console.warn('RESEND_API_KEY not set — skipping confirmation email'); return; }

  const fmt = cents => '$' + (parseInt(cents || '0', 10) / 100).toFixed(2);

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

  const fmtSubjectDate = s => {
    const [y, m, day] = s.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(day))
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const ci  = dateParts(d.checkin);
  const co  = dateParts(d.checkout);
  const ref = 'SH-' + (d.session_id || '').replace(/^cs_(test_|live_)/, '').slice(0, 8).toUpperCase();
  const total = parseInt(d.price_cents||0) + parseInt(d.cleaning_fee_cents||0) + parseInt(d.pet_fee_cents||0) + parseInt(d.tax_cents||0);

  const cleaningRow = parseInt(d.cleaning_fee_cents || '0') > 0
    ? `<tr><td style="padding:9px 0;color:#666;font-size:14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Cleaning fee</td><td align="right" style="padding:9px 0;font-size:14px;color:#333;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${fmt(d.cleaning_fee_cents)}</td></tr>`
    : '';
  const petRow = parseInt(d.pet_fee_cents || '0') > 0
    ? `<tr><td style="padding:9px 0;color:#666;font-size:14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Pet fee</td><td align="right" style="padding:9px 0;font-size:14px;color:#333;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${fmt(d.pet_fee_cents)}</td></tr>`
    : '';
  const taxRow = parseInt(d.tax_cents || '0') > 0
    ? `<tr><td style="padding:9px 0;color:#666;font-size:14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Taxes &amp; fees</td><td align="right" style="padding:9px 0;font-size:14px;color:#333;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${fmt(d.tax_cents)}</td></tr>`
    : '';

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
    <p style="margin:0 0 20px;color:rgba(245,241,232,0.7);font-size:16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Your booking is confirmed.</p>
    <p style="margin:0;font-size:11px;letter-spacing:1.5px;color:rgba(245,241,232,0.45);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Booking ref: ${ref}</p>
  </td></tr>

  <tr><td style="background:#ffffff;padding:32px 40px 0;">
    <p style="margin:0 0 28px;font-size:16px;color:#444;line-height:1.7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Hi ${d.first_name}, we're looking forward to hosting you. Here are your details.</p>

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
          <p style="margin:0 0 3px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#bbb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Check-in time</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#1A332F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">4:00 PM</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 10px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#aaa;font-weight:600;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Payment summary</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e8e4dc;">
      <tr><td style="padding:9px 0;color:#666;font-size:14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Accommodation (${d.nights} night${parseInt(d.nights)!==1?'s':''})</td><td align="right" style="padding:9px 0;font-size:14px;color:#333;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${fmt(d.price_cents)}</td></tr>
      ${cleaningRow}
      ${petRow}
      ${taxRow}
      <tr><td style="padding:14px 0 32px;border-top:2px solid #1A332F;font-weight:700;color:#1A332F;font-size:16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Total charged</td><td align="right" style="padding:14px 0 32px;border-top:2px solid #1A332F;font-weight:700;color:#1A332F;font-size:16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${fmt(total)}</td></tr>
    </table>
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 40px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e4dc;border-radius:4px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#aaa;font-weight:600;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Cancellation policy</p>
        <p style="margin:0;font-size:14px;color:#444;line-height:1.7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Cancel at least <strong>14 days before check-in</strong> for a full refund. Cancellations made within 14 days of check-in are non-refundable. To cancel, email <a href="mailto:contact@shankton.com" style="color:#1A332F;text-decoration:none;">contact@shankton.com</a>.</p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="background:#1A332F;padding:32px 40px;">
    <p style="margin:0 0 28px;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:rgba(245,241,232,0.4);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">What happens next</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td valign="top" width="48" style="padding-right:16px;padding-bottom:22px;">
          <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:32px;height:32px;background:rgba(255,255,255,0.1);border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#f5f1e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:32px;">1</td></tr></table>
        </td>
        <td valign="top" style="padding-bottom:22px;">
          <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#f5f1e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">48 hours before arrival</p>
          <p style="margin:0;font-size:13px;color:rgba(245,241,232,0.6);line-height:1.6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">You'll receive a separate email at this address with your door code, WiFi password, parking details, and full check-in instructions. Check your spam folder if you don't see it.</p>
        </td>
      </tr>
      <tr>
        <td valign="top" width="48" style="padding-right:16px;padding-bottom:22px;">
          <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:32px;height:32px;background:rgba(255,255,255,0.1);border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#f5f1e8;font-family:'Helvetice Neue',Helvetica,Arial,sans-serif;line-height:32px;">2</td></tr></table>
        </td>
        <td valign="top" style="padding-bottom:22px;">
          <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#f5f1e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Self check-in from 4:00 PM</p>
          <p style="margin:0;font-size:13px;color:rgba(245,241,232,0.6);line-height:1.6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">No need to meet anyone — arrive at your own pace.</p>
        </td>
      </tr>
      <tr>
        <td valign="top" width="48" style="padding-right:16px;">
          <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:32px;height:32px;background:rgba(255,255,255,0.1);border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#f5f1e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:32px;">3</td></tr></table>
        </td>
        <td valign="top">
          <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#f5f1e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Enjoy your stay</p>
          <p style="margin:0;font-size:13px;color:rgba(245,241,232,0.6);line-height:1.6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">We're available 24/7 — reply to this email or write to <a href="mailto:contact@shankton.com" style="color:rgba(245,241,232,0.75);text-decoration:none;">contact@shankton.com</a>.</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="background:#f0ede5;border-radius:0 0 6px 6px;padding:24px 40px;">
    <p style="margin:0;font-size:12px;color:#aaa;line-height:2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      Shankton Properties · <a href="https://www.shankton.com" style="color:#aaa;text-decoration:none;">shankton.com</a> · <a href="https://www.shankton.com/terms.html" style="color:#aaa;text-decoration:none;">Terms &amp; Conditions</a><br>
      Questions? Email <a href="mailto:contact@shankton.com" style="color:#888;text-decoration:none;">contact@shankton.com</a> — we respond promptly.<br>
      Nicaragua: Nemer <a href="https://wa.me/50558112744" style="color:#888;text-decoration:none;">+505 5811 2744</a> (WhatsApp) &nbsp;·&nbsp; California: Jasmin <a href="tel:+17147376193" style="color:#888;text-decoration:none;">+1 714 737 6193</a> &nbsp;·&nbsp; Emergency: Clifton <a href="tel:+18017598509" style="color:#888;text-decoration:none;">+1 801 759 8509</a><br>
      To cancel, email us at least 14 days before check-in for a full refund.
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
        from: 'Shankton Properties <contact@shankton.com>',
        to: `${d.first_name} ${d.last_name} <${d.email}>`,
        reply_to: 'contact@shankton.com',
        subject: `Booking confirmed · ${d.property_name} · ${fmtSubjectDate(d.checkin)}`,
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
