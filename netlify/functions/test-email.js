exports.handler = async () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { statusCode: 500, body: 'RESEND_API_KEY not set' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Shankton Properties <contact@shankton.com>',
      to: 'cliftontolboe@me.com',
      subject: 'Netlify key test — Shankton',
      html: '<p>RESEND_API_KEY in Netlify is working correctly.</p>',
    }),
  });

  const body = await res.text();
  return { statusCode: res.status, body };
};
