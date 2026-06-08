(function () {
  const gallery = document.querySelector('.gallery');
  const cells   = Array.from(document.querySelectorAll('.gallery-cell'));
  if (!cells.length) return;

  const images = cells.map(cell => {
    const bg = cell.querySelector('.gallery-cell-bg');
    if (!bg) return null;
    const m  = bg.style.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
    return m ? m[1] : null;
  }).filter(Boolean);

  if (!images.length) return;

  // ── Lightbox ───────────────────────────────────────────────────────────────
  const lb = document.createElement('div');
  lb.className = 'glb';
  lb.innerHTML = `
    <button class="glb-close" aria-label="Close">✕</button>
    <button class="glb-prev" aria-label="Previous">&#8249;</button>
    <img class="glb-img" src="" alt="">
    <button class="glb-next" aria-label="Next">&#8250;</button>
    <div class="glb-count"></div>
  `;
  document.body.appendChild(lb);

  const lbImg   = lb.querySelector('.glb-img');
  const lbCount = lb.querySelector('.glb-count');
  let cur = 0;

  function show(i) {
    cur = (i + images.length) % images.length;
    lbImg.src = images[cur];
    lbCount.textContent = (cur + 1) + ' / ' + images.length;
    lb.classList.add('glb-open');
    document.body.style.overflow = 'hidden';
    setDot(cur);
  }

  function closeLb() {
    lb.classList.remove('glb-open');
    document.body.style.overflow = '';
  }

  cells.forEach((cell, i) => {
    cell.style.cursor = 'pointer';
    cell.setAttribute('role', 'button');
    cell.setAttribute('tabindex', '0');
    cell.setAttribute('aria-label', 'View photo ' + (i + 1) + ' of ' + images.length);
    cell.addEventListener('click', () => show(i));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); }
    });
  });

  lb.querySelector('.glb-close').addEventListener('click', closeLb);
  lb.querySelector('.glb-prev').addEventListener('click', e => { e.stopPropagation(); show(cur - 1); });
  lb.querySelector('.glb-next').addEventListener('click', e => { e.stopPropagation(); show(cur + 1); });
  lb.addEventListener('click', e => { if (e.target === lb || e.target === lbImg) closeLb(); });

  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('glb-open')) return;
    if (e.key === 'Escape')      closeLb();
    if (e.key === 'ArrowLeft')   show(cur - 1);
    if (e.key === 'ArrowRight')  show(cur + 1);
  });

  // Swipe on entire lightbox overlay
  let lbTx = 0;
  lb.addEventListener('touchstart', e => { lbTx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - lbTx;
    if (Math.abs(dx) > 40) dx < 0 ? show(cur + 1) : show(cur - 1);
  });

  // ── Gallery inline arrows ──────────────────────────────────────────────────
  if (gallery) {
    // Wrap gallery so arrows sit outside the scroll container
    const wrap = document.createElement('div');
    wrap.className = 'gal-wrap';
    gallery.parentNode.insertBefore(wrap, gallery);
    wrap.appendChild(gallery);

    const prevBtn = document.createElement('button');
    prevBtn.className = 'gal-arrow gal-arrow-prev';
    prevBtn.setAttribute('aria-label', 'Previous photo');
    prevBtn.innerHTML = '&#8249;';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'gal-arrow gal-arrow-next';
    nextBtn.setAttribute('aria-label', 'Next photo');
    nextBtn.innerHTML = '&#8250;';

    wrap.appendChild(prevBtn);
    wrap.appendChild(nextBtn);

    let galIdx = 0;

    function isMobile() { return window.innerWidth <= 600; }

    function galGo(i) {
      galIdx = (i + cells.length) % cells.length;
      if (isMobile()) {
        cells[galIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        show(galIdx);
      }
      setDot(galIdx);
    }

    prevBtn.addEventListener('click', e => { e.stopPropagation(); galGo(galIdx - 1); });
    nextBtn.addEventListener('click', e => { e.stopPropagation(); galGo(galIdx + 1); });

    // Sync dot index from scroll position on mobile
    gallery.addEventListener('scroll', () => {
      if (!isMobile()) return;
      const w   = cells[0] ? cells[0].offsetWidth : 1;
      const idx = Math.round(gallery.scrollLeft / w);
      if (idx !== galIdx) { galIdx = Math.min(idx, cells.length - 1); setDot(galIdx); }
    }, { passive: true });
  }

  // ── Dot indicators ─────────────────────────────────────────────────────────
  const dotsWrap = document.createElement('div');
  dotsWrap.className = 'gal-dots';
  if (gallery) {
    const wrapEl = gallery.closest('.gal-wrap') || gallery;
    if (wrapEl.parentNode) {
      wrapEl.parentNode.insertBefore(dotsWrap, wrapEl.nextSibling);
    }
  }

  const dots = cells.map((_, i) => {
    const d = document.createElement('button');
    d.className = 'gal-dot' + (i === 0 ? ' gal-dot-active' : '');
    d.setAttribute('aria-label', 'Photo ' + (i + 1));
    d.addEventListener('click', () => {
      if (window.innerWidth <= 600) {
        cells[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        show(i);
      }
      setDot(i);
    });
    dotsWrap.appendChild(d);
    return d;
  });

  function setDot(i) {
    dots.forEach((d, j) => d.classList.toggle('gal-dot-active', j === i));
  }
}());
