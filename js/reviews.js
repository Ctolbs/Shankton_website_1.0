(function () {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  const cfg = window.BOOKING_CONFIGS ? window.BOOKING_CONFIGS[0] : window.BOOKING_CONFIG;
  if (!cfg || !cfg.propertyId) return;

  fetch('/.netlify/functions/get-reviews?property_id=' + cfg.propertyId)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(({ reviews }) => {
      if (!reviews || reviews.length < 3) return;
      grid.innerHTML = reviews.map(r => `
        <div class="review-card">
          <div style="color:var(--sand);font-size:13px;letter-spacing:2px;margin-bottom:12px;">★★★★★</div>
          <p class="review-card-text">“${r.text}”</p>
          <div class="review-card-author">
            <div class="review-card-avatar">${r.initial}</div>
            <div>
              <div class="review-card-meta">${r.author}</div>
              <div class="review-card-date">${r.date}</div>
            </div>
          </div>
        </div>`).join('');
    })
    .catch(() => {}); // silently keep hardcoded cards on any failure
}());
