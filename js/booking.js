// Inline booking card
// Reads window.BOOKING_CONFIGS (array, for multi-unit pages like Peninsula)
// or window.BOOKING_CONFIG (single object, for Harbour / Tower).
// Each config may include a `prefix` string to namespace element IDs —
// e.g. prefix "a" maps "bc-checkin" → "a-bc-checkin".

(function () {
  const configs = window.BOOKING_CONFIGS
    ? window.BOOKING_CONFIGS
    : window.BOOKING_CONFIG
      ? [window.BOOKING_CONFIG]
      : [];

  configs.forEach(initCard);

  function initCard(cfg) {
    const pfx = cfg.prefix ? cfg.prefix + '-' : '';
    const $ = id => document.getElementById(pfx + id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Populate guest options
    const guestSel = $('bc-guests');
    for (let i = 1; i <= cfg.maxGuests; i++) {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = i + ' guest' + (i > 1 ? 's' : '');
      if (i === 2) o.selected = true;
      guestSel.appendChild(o);
    }

    // Pet fee checkbox
    if (cfg.petFee) {
      const petDiv = document.createElement('div');
      petDiv.className = 'booking-guests';
      petDiv.innerHTML = `
        <label class="bc-pet-label">
          <input type="checkbox" id="${pfx}bc-pet" class="bc-pet-check">
          <span>Bringing a pet? <span class="bc-pet-amount">+$${cfg.petFee / 100}</span></span>
        </label>`;
      guestSel.parentElement.insertAdjacentElement('afterend', petDiv);
      document.getElementById(pfx + 'bc-pet').addEventListener('change', checkAvail);
    }

    // ── Calendar state ──────────────────────────────────────────────────────
    let stage       = null; // null | 'checkin' | 'checkout'
    let checkinDate = null;
    let checkoutDate = null;
    let hoverDate   = null;
    let viewYear    = tomorrow.getFullYear();
    let viewMonth   = tomorrow.getMonth();

    function parseLocal(str) {
      if (!str) return null;
      const [y, m, d] = str.split('-').map(Number);
      return new Date(y, m - 1, d);
    }

    function toValue(d) {
      if (!d) return '';
      return d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0');
    }

    function toDisplay(d) {
      if (!d) return 'Add date';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function openCalendar(startStage) {
      stage = startStage;
      if (startStage === 'checkout' && checkinDate) {
        viewYear  = checkinDate.getFullYear();
        viewMonth = checkinDate.getMonth();
      } else if (!checkinDate) {
        viewYear  = tomorrow.getFullYear();
        viewMonth = tomorrow.getMonth();
      }
      renderCal();
      $('bc-cal').style.display = 'block';
      syncHighlight();
    }

    function closeCalendar() {
      stage = null;
      hoverDate = null;
      $('bc-cal').style.display = 'none';
      syncHighlight();
    }

    function syncHighlight() {
      const ci = $('bc-checkin-field');
      const co = $('bc-checkout-field');
      if (ci) ci.classList.toggle('bc-field-active', stage === 'checkin');
      if (co) co.classList.toggle('bc-field-active', stage === 'checkout');
    }

    function renderCal() {
      const cal       = $('bc-cal');
      const firstDay  = new Date(viewYear, viewMonth, 1);
      const lastDay   = new Date(viewYear, viewMonth + 1, 0);
      const startDow  = firstDay.getDay();
      const DAYS      = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const label     = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const rangeEnd  = (stage === 'checkout' && hoverDate) ? hoverDate : checkoutDate;

      let html = `
        <div class="bc-cal-header">
          <button class="bc-cal-nav" data-dir="-1">&#8249;</button>
          <span class="bc-cal-month">${label}</span>
          <button class="bc-cal-nav" data-dir="1">&#8250;</button>
        </div>
        <div class="bc-cal-grid">
          ${DAYS.map(d => `<span class="bc-cal-dow">${d}</span>`).join('')}`;

      for (let i = 0; i < startDow; i++) html += `<span></span>`;

      for (let d = 1; d <= lastDay.getDate(); d++) {
        const date    = new Date(viewYear, viewMonth, d);
        const isPast  = date < tomorrow;
        const isCI    = checkinDate  && date.getTime() === checkinDate.getTime();
        const isCO    = checkoutDate && date.getTime() === checkoutDate.getTime();

        let inRange = false, isStart = false, isEnd = false;
        if (checkinDate && rangeEnd && checkinDate.getTime() !== rangeEnd.getTime()) {
          const s = checkinDate < rangeEnd ? checkinDate : rangeEnd;
          const e = checkinDate < rangeEnd ? rangeEnd    : checkinDate;
          isStart = date.getTime() === s.getTime();
          isEnd   = date.getTime() === e.getTime();
          inRange = date > s && date < e;
        }

        let cls = 'bc-cal-day';
        if (isPast)            cls += ' past';
        if (!isPast)           cls += ' avail';
        if (isCI || isStart)   cls += ' sel start';
        if (isCO || isEnd)     cls += ' sel end';
        if (inRange)           cls += ' range';

        const attr = !isPast ? ` data-date="${toValue(date)}"` : '';
        html += `<span class="${cls}"${attr}>${d}</span>`;
      }

      html += `</div>`;
      html += `<div class="bc-cal-hint">${stage === 'checkin' ? 'Select check-in date' : 'Select check-out date'}</div>`;

      cal.innerHTML = html;
    }

    // ── Calendar event delegation (bound once, works across re-renders) ───────
    (function bindCalEvents() {
      const cal = $('bc-cal');

      cal.addEventListener('click', e => {
        e.stopPropagation();

        const nav = e.target.closest('.bc-cal-nav');
        if (nav) {
          viewMonth += parseInt(nav.dataset.dir);
          if (viewMonth > 11) { viewMonth = 0; viewYear++; }
          if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
          renderCal();
          return;
        }

        const day = e.target.closest('.bc-cal-day.avail');
        if (!day) return;
        const date = parseLocal(day.dataset.date);
        if (!date) return;

        if (stage === 'checkin') {
          checkinDate  = date;
          checkoutDate = null;
          hoverDate    = null;
          $('bc-checkin').value                = toValue(date);
          $('bc-checkout').value               = '';
          $('bc-checkin-display').textContent  = toDisplay(date);
          $('bc-checkout-display').textContent = 'Add date';
          $('bc-status').textContent           = '';
          $('bc-status').className             = 'bc-status';
          $('bc-breakdown').style.display      = 'none';
          $('bc-contact').style.display        = 'none';
          $('bc-btn').style.display            = 'none';
          $('bc-secure').style.display         = 'none';
          stage = 'checkout';
          syncHighlight();
          renderCal();

        } else if (stage === 'checkout') {
          if (date <= checkinDate) {
            checkinDate  = date;
            checkoutDate = null;
            hoverDate    = null;
            $('bc-checkin').value                = toValue(date);
            $('bc-checkout').value               = '';
            $('bc-checkin-display').textContent  = toDisplay(date);
            $('bc-checkout-display').textContent = 'Add date';
            renderCal();
          } else {
            checkoutDate = date;
            $('bc-checkout').value               = toValue(date);
            $('bc-checkout-display').textContent = toDisplay(date);
            closeCalendar();
            checkAvail();
          }
        }
      });

      // mouseover bubbles, so we can delegate from cal
      cal.addEventListener('mouseover', e => {
        if (stage !== 'checkout') return;
        const day = e.target.closest('.bc-cal-day.avail');
        if (!day) return;
        const date = parseLocal(day.dataset.date);
        if (!date) return;
        if (!hoverDate || hoverDate.getTime() !== date.getTime()) {
          hoverDate = date;
          renderCal();
        }
      });

      cal.addEventListener('mouseleave', () => {
        if (stage === 'checkout' && hoverDate) {
          hoverDate = null;
          renderCal();
        }
      });
    }());

    // Trigger field clicks
    $('bc-checkin-field').addEventListener('click', e => {
      e.stopPropagation();
      if (stage === 'checkin') { closeCalendar(); return; }
      openCalendar('checkin');
    });

    $('bc-checkout-field').addEventListener('click', e => {
      e.stopPropagation();
      if (stage === 'checkout') { closeCalendar(); return; }
      if (!checkinDate) { openCalendar('checkin'); return; }
      openCalendar('checkout');
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (stage === null) return;
      const cal     = $('bc-cal');
      const dateRow = $('bc-date-row');
      if (cal && !cal.contains(e.target) && dateRow && !dateRow.contains(e.target)) {
        closeCalendar();
      }
    });

    // ── Availability check ───────────────────────────────────────────────────
    async function checkAvail() {
      const checkin  = $('bc-checkin').value;
      const checkout = $('bc-checkout').value;
      if (!checkin || !checkout || checkin >= checkout) return;

      const status = $('bc-status');
      status.textContent = 'Checking availability…';
      status.className   = 'bc-status checking';
      $('bc-breakdown').style.display = 'none';
      $('bc-contact').style.display   = 'none';
      $('bc-btn').style.display       = 'none';
      $('bc-secure').style.display    = 'none';

      try {
        const pricingParam = cfg.pricingPropertyId
          ? `&pricing_id=${cfg.pricingPropertyId}`
          : '';
        const res  = await fetch(
          `/.netlify/functions/check-availability?property_id=${cfg.propertyId}&checkin=${checkin}&checkout=${checkout}${pricingParam}`
        );
        const data = await res.json();

        if (!data.available) {
          status.textContent = '✕ ' + (data.reason || 'Not available for those dates');
          status.className   = 'bc-status no';
          return;
        }

        const fmt         = n => '$' + n.toLocaleString('en-US');
        const avgNightly  = Math.round(data.price_dollars / data.nights);
        const cleaningDollars = cfg.cleaningFee / 100;
        const petCheck    = document.getElementById(pfx + 'bc-pet');
        const petDollars  = (petCheck && petCheck.checked) ? cfg.petFee / 100 : 0;
        const subtotal    = data.price_dollars + cleaningDollars + petDollars;
        const taxDollars  = cfg.taxRate  ? Math.round(subtotal * cfg.taxRate / 100 * 100) / 100
                          : cfg.taxFlat ? cfg.taxFlat / 100
                          : 0;
        const totalDollars = subtotal + taxDollars;
        const taxCents     = Math.round(taxDollars * 100);

        status.textContent = '✓ Available — ' + data.nights + ' night' + (data.nights !== 1 ? 's' : '');
        status.className   = 'bc-status ok';

        $('bc-breakdown').innerHTML = `
          <div class="bc-price-row"><span>${data.nights} nights (avg ${fmt(avgNightly)}/night)</span><span>${fmt(data.price_dollars)}</span></div>
          <div class="bc-price-row"><span>Cleaning fee</span><span>${fmt(cleaningDollars)}</span></div>
          ${petDollars ? `<div class="bc-price-row"><span>Pet fee</span><span>${fmt(petDollars)}</span></div>` : ''}
          ${taxDollars ? `<div class="bc-price-row"><span>${cfg.taxLabel || 'Taxes &amp; fees'}</span><span>${fmt(taxDollars)}</span></div><p class="bc-tax-note">Collected and remitted per local law</p>` : ''}
          <div class="bc-price-row total"><span>Total</span><span>${fmt(totalDollars)}</span></div>
          <p class="bc-cancel-note">Cancellations &amp; changes: <a href="mailto:contact@shankton.com">contact@shankton.com</a></p>
        `;
        $('bc-breakdown').style.display = 'block';
        $('bc-contact').style.display   = 'flex';
        $('bc-btn').style.display       = 'block';
        $('bc-secure').style.display    = 'block';
        $('bc-btn').dataset.priceCents  = data.price_cents;
        $('bc-btn').dataset.nights      = data.nights;
        $('bc-btn').dataset.taxCents    = taxCents;
        $('bc-btn').dataset.petFeeCents = Math.round(petDollars * 100);

      } catch {
        status.textContent = 'Unable to check. Please try again.';
        status.className   = 'bc-status no';
      }
    }

    // ── Checkout button ──────────────────────────────────────────────────────
    $('bc-btn').addEventListener('click', async () => {
      const checkin   = $('bc-checkin').value;
      const checkout  = $('bc-checkout').value;
      const guests    = parseInt($('bc-guests').value);
      const firstName = $('bc-first').value.trim();
      const lastName  = $('bc-last').value.trim();
      const email     = $('bc-email').value.trim();
      const phone     = $('bc-phone').value.trim();

      if (!firstName || !lastName || !email) {
        if (!firstName) $('bc-first').style.borderColor = '#b94040';
        if (!lastName)  $('bc-last').style.borderColor  = '#b94040';
        if (!email)     $('bc-email').style.borderColor = '#b94040';
        return;
      }

      const btn = $('bc-btn');
      btn.textContent = 'Redirecting…';
      btn.disabled    = true;

      try {
        const res  = await fetch('/.netlify/functions/create-checkout', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            property_id:        cfg.propertyId,
            property_name:      cfg.propertyName,
            cancel_path:        cfg.cancelPath || '/',
            checkin, checkout, guests,
            first_name:         firstName,
            last_name:          lastName,
            email, phone,
            nights:             parseInt(btn.dataset.nights),
            price_cents:        parseInt(btn.dataset.priceCents),
            cleaning_fee_cents: cfg.cleaningFee,
            pet_fee_cents:      parseInt(btn.dataset.petFeeCents || '0'),
            tax_cents:          parseInt(btn.dataset.taxCents    || '0'),
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
        btn.disabled    = false;
        alert('Something went wrong. Please try again or email contact@shankton.com');
      }
    });

    // ── Live floor price ─────────────────────────────────────────────────────
    // Fetch the minimum available nightly rate for the next 45 days from
    // Hospitable and update the "From $X / night" headline. Cached 1hr at CDN.
    (async function updateFloorPrice() {
      try {
        const res  = await fetch(`/.netlify/functions/get-floor-price?property_id=${cfg.propertyId}`);
        const data = await res.json();
        if (!data.floor_dollars) return;
        const priceEl = document.querySelector('.booking-price');
        if (!priceEl) return;
        const sub = priceEl.querySelector('span');
        priceEl.childNodes[0].textContent = 'From $' + Math.round(data.floor_dollars).toLocaleString('en-US') + ' ';
        if (!sub) priceEl.appendChild(Object.assign(document.createElement('span'), {
          style: 'font-size:16px;color:var(--text-muted);font-family:\'Inter\',sans-serif;font-weight:400;',
          textContent: '/ night',
        }));
      } catch { /* fail silently — static fallback stays visible */ }
    }());
  }
})();
