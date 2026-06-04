(function () {
  const cells = Array.from(document.querySelectorAll('.gallery-cell'));
  if (!cells.length) return;

  const images = cells.map(cell => {
    const bg = cell.querySelector('.gallery-cell-bg');
    if (!bg) return null;
    const m = bg.style.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
    return m ? m[1] : null;
  }).filter(Boolean);

  if (!images.length) return;

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

  const img   = lb.querySelector('.glb-img');
  const count = lb.querySelector('.glb-count');
  let cur = 0;

  function show(i) {
    cur = (i + images.length) % images.length;
    img.src = images[cur];
    count.textContent = (cur + 1) + ' / ' + images.length;
    lb.classList.add('glb-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lb.classList.remove('glb-open');
    document.body.style.overflow = '';
  }

  cells.forEach((cell, i) => {
    cell.style.cursor = 'pointer';
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', 'View photo ' + (i + 1));
    cell.addEventListener('click', () => show(i));
  });

  lb.querySelector('.glb-close').addEventListener('click', close);
  lb.querySelector('.glb-prev').addEventListener('click', e => { e.stopPropagation(); show(cur - 1); });
  lb.querySelector('.glb-next').addEventListener('click', e => { e.stopPropagation(); show(cur + 1); });
  lb.addEventListener('click', e => { if (e.target === lb || e.target === img) close(); });

  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('glb-open')) return;
    if (e.key === 'Escape')      close();
    if (e.key === 'ArrowLeft')   show(cur - 1);
    if (e.key === 'ArrowRight')  show(cur + 1);
  });

  // Touch swipe
  let tx = 0;
  img.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  img.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 40) dx < 0 ? show(cur + 1) : show(cur - 1);
  });
}());
