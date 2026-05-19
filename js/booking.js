// Inline booking card — reads BOOKING_CONFIG set per-page
(function () {
  const cfg = window.BOOKING_CONFIG;
  if (!cfg) return;

  const $ = id => document.getElementById(id);

  // Set min date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];
  $('bc-checkin').min = minDate;
  $('bc-checkout').min = minDate;

  // Populate guest options
  const guestSel = $('bc-guests');
  for (let i = 1; i <= cfg.maxGuests; i++) {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = i + ' guest' + (i > 1 ? 's' : '');
    if (i === 2) o.selected = true;
    guestSel.appendChild(o);
  }

  $('bc-checkin').addEventListener('change', () => {
    const ci = $('bc-checkin').value;
    if (ci) {
      const next = new Date(ci);
      next.setDate(next.getDate() + 1);
      $('bc-checkout').min = next.toISOString().split('T')[0];
      if ($('bc-checkout').value && $('bc-checkout').value <= ci) {
        $('bc-checkout').value = '';
      }
    }
    checkAvail();
  });
  $('bc-checkout').addEventListener('change', checkAvail);

  async function checkAvail() {
    const checkin = $('bc-checkin').value;
    const checkout = $('bc-checkout').value;
    if (!checkin || !checkout || checkin >= checkout) return;

    const status = $('bc-status');
    status.textContent = 'Checking availability…';
    status.className = 'bc-status checking';
    $('bc-breakdown').style.display = 'none';
    $('bc-contact').style.display = 'none';
    $('bc-btn').style.display = 'none';

    try {
      const res = await fetch(
        `/.netlify/functions/check-availability?property_id=${cfg.propertyId}&checkin=${checkin}&checkout=${checkout}`
      );
      const data = await res.json();

      if (!data.available) {
        status.textContent = '✕ ' + (data.reason || 'Not available for those dates');
        status.className = 'bc-status no';
        return;
      }

      const cleaningDollars = cfg.cleaningFee / 100;
      const totalDollars = data.price_dollars + cleaningDollars;
      const avgNightly = Math.round(data.price_dollars / data.nights);
      const fmt = n => '$' + n.toLocaleString('en-US');

      status.textContent = '✓ Available — ' + data.nights + ' night' + (data.nights !== 1 ? 's' : '');
      status.className = 'bc-status ok';

      $('bc-breakdown').innerHTML = `
        <div class="bc-price-row"><span>${data.nights} nights (avg ${fmt(avgNightly)}/night)</span><span>${fmt(data.price_dollars)}</span></div>
        <div class="bc-price-row"><span>Cleaning fee</span><span>${fmt(cleaningDollars)}</span></div>
        <div class="bc-price-row total"><span>Total</span><span>${fmt(totalDollars)}</span></div>
      `;
      $('bc-breakdown').style.display = 'block';
      $('bc-contact').style.display = 'flex';
      $('bc-btn').style.display = 'block';
      $('bc-btn').dataset.priceCents = data.price_cents;
      $('bc-btn').dataset.nights = data.nights;

    } catch {
      status.textContent = 'Unable to check. Please try again.';
      status.className = 'bc-status no';
    }
  }

  $('bc-btn').addEventListener('click', async () => {
    const checkin = $('bc-checkin').value;
    const checkout = $('bc-checkout').value;
    const guests = parseInt($('bc-guests').value);
    const firstName = $('bc-first').value.trim();
    const lastName = $('bc-last').value.trim();
    const email = $('bc-email').value.trim();
    const phone = $('bc-phone').value.trim();

    if (!firstName || !lastName || !email) {
      if (!firstName) $('bc-first').style.borderColor = '#b94040';
      if (!lastName)  $('bc-last').style.borderColor  = '#b94040';
      if (!email)     $('bc-email').style.borderColor = '#b94040';
      return;
    }

    const btn = $('bc-btn');
    btn.textContent = 'Redirecting…';
    btn.disabled = true;

    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: cfg.propertyId,
          property_name: cfg.propertyName,
          checkin, checkout, guests,
          first_name: firstName,
          last_name: lastName,
          email, phone,
          nights: parseInt(btn.dataset.nights),
          price_cents: parseInt(btn.dataset.priceCents),
          cleaning_fee_cents: cfg.cleaningFee,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL');
      }
    } catch {
      btn.textContent = 'Book Direct →';
      btn.disabled = false;
      alert('Something went wrong. Please try again or email contact@shankton.com');
    }
  });
})();
