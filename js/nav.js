(function () {
  const nav = document.querySelector('.nav');
  const hamburger = document.querySelector('.nav-hamburger');
  if (!nav || !hamburger) return;

  hamburger.addEventListener('click', e => {
    e.stopPropagation();
    nav.classList.toggle('nav-open');
  });

  // Close when a nav link is clicked
  nav.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', () => nav.classList.remove('nav-open'));
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!nav.contains(e.target)) nav.classList.remove('nav-open');
  });
}());
