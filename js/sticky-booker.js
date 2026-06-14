(function () {
  var bar      = document.getElementById('sticky-booker');
  var mobBar   = document.getElementById('sb-mobile-bar');
  var mobOpen  = document.getElementById('sb-mobile-open');
  var backdrop = document.getElementById('sb-sheet-backdrop');
  var sheet    = document.getElementById('sb-sheet');
  var hero     = document.querySelector('.hero-showcase');

  if (!hero) return;

  // Show/hide on hero scroll
  var obs = new IntersectionObserver(function (entries) {
    var visible = !entries[0].isIntersecting;
    if (bar)    bar.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (bar)    bar.classList.toggle('sb-visible', visible);
    if (mobBar) mobBar.classList.toggle('sb-visible', visible);
  }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' });
  obs.observe(hero);

  // Build guests select
  function buildGuests(sel, max) {
    var prev = parseInt(sel.value) || 2;
    sel.innerHTML = '';
    for (var i = 1; i <= max; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i + (i === 1 ? ' Guest' : ' Guests');
      sel.appendChild(opt);
    }
    sel.value = Math.min(prev, max);
  }

  function maxFor(sel) {
    var opt = sel.options[sel.selectedIndex];
    return parseInt(opt && opt.dataset.max) || 8;
  }

  // Desktop selects
  var propSel   = document.getElementById('sb-property');
  var guestsSel = document.getElementById('sb-guests');
  if (propSel && guestsSel) {
    buildGuests(guestsSel, maxFor(propSel));
    propSel.addEventListener('change', function () { buildGuests(guestsSel, maxFor(propSel)); });
  }

  // Sheet selects
  var sheetProp   = document.getElementById('sb-sheet-property');
  var sheetGuests = document.getElementById('sb-sheet-guests');
  if (sheetProp && sheetGuests) {
    buildGuests(sheetGuests, maxFor(sheetProp));
    sheetProp.addEventListener('change', function () { buildGuests(sheetGuests, maxFor(sheetProp)); });
  }

  // Date mins
  var today = new Date().toISOString().split('T')[0];
  ['sb-checkin', 'sb-checkout', 'sb-sheet-checkin', 'sb-sheet-checkout'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.min = today;
  });

  function linkDates(inId, outId) {
    var inEl  = document.getElementById(inId);
    var outEl = document.getElementById(outId);
    if (!inEl || !outEl) return;
    inEl.addEventListener('change', function () {
      outEl.min = inEl.value || today;
      if (outEl.value && outEl.value <= inEl.value) outEl.value = '';
    });
  }
  linkDates('sb-checkin',       'sb-checkout');
  linkDates('sb-sheet-checkin', 'sb-sheet-checkout');

  // Navigate on CTA
  function navigate(propEl, inId, outId, guestsEl) {
    var opt      = propEl.options[propEl.selectedIndex];
    var base     = opt.value;
    var unit     = opt.dataset.unit || '';
    var checkin  = (document.getElementById(inId)  || {}).value || '';
    var checkout = (document.getElementById(outId) || {}).value || '';
    var guests   = guestsEl ? guestsEl.value : '';

    var p = new URLSearchParams();
    if (checkin)  p.set('checkin',  checkin);
    if (checkout) p.set('checkout', checkout);
    if (guests)   p.set('guests',   guests);
    if (unit)     p.set('unit',     unit);

    window.location.href = '/' + base + (p.toString() ? '?' + p.toString() : '');
  }

  var ctaBtn = document.getElementById('sb-cta');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', function () {
      navigate(propSel, 'sb-checkin', 'sb-checkout', guestsSel);
    });
  }

  var sheetCta = document.getElementById('sb-sheet-cta');
  if (sheetCta) {
    sheetCta.addEventListener('click', function () {
      navigate(sheetProp, 'sb-sheet-checkin', 'sb-sheet-checkout', sheetGuests);
    });
  }

  // Sheet open / close
  function openSheet() {
    backdrop.style.display = 'block';
    sheet.style.display    = 'block';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        backdrop.classList.add('sb-sheet-open');
        sheet.classList.add('sb-sheet-open');
      });
    });
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    backdrop.classList.remove('sb-sheet-open');
    sheet.classList.remove('sb-sheet-open');
    sheet.addEventListener('transitionend', function () {
      backdrop.style.display = 'none';
      sheet.style.display    = 'none';
    }, { once: true });
    document.body.style.overflow = '';
  }

  if (mobOpen)  mobOpen.addEventListener('click', openSheet);
  if (backdrop) backdrop.addEventListener('click', closeSheet);
}());
