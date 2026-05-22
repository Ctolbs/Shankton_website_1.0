// ── Shankton Properties ─────────────────────────────────────────────────────
// Single source of truth for the collection. Homepage cards are generated
// from this array — add/edit here, not in index.html.
//
// status: "active" | "coming-soon" | "offline"
// When a photo is available, replace `gradient` with `photo: "img/filename.jpg"`

const SHANKTON_PROPERTIES = [
  {
    id: "harbour",
    name: "Shankton Harbour",
    location: "Playa Gigante · Nicaragua",
    tagline: "The only home in Gigante with its own sea shelf. Tide pools, snorkeling, and reef fishing — from your own platform.",
    specs: "3 BR · 3.5 BA · Sleeps 8",
    rating: 4.87,
    reviews: 278,
    url: "harbour/",
    photo: "images/nica/harbour/hero.jpg",
    gradient: "linear-gradient(160deg,#1A332F 0%,#0d1e1c 100%)",
    status: "active"
  },
  {
    id: "tower",
    name: "Shankton Tower",
    location: "Playa Gigante · Nicaragua",
    tagline: "Cliff-top Pacific views. Malibu-rugged, four floors up. Infinity pool over the ocean. Private beach. Bunk room for the kids.",
    specs: "4 BR + bunk · 4 BA · Sleeps 12",
    rating: 4.79,
    reviews: 290,
    url: "tower/",
    photo: "images/nica/tower/hero.jpg",
    gradient: "linear-gradient(160deg,#152B28 0%,#0a1210 100%)",
    status: "active"
  },
  {
    id: "peninsula",
    name: "Shankton Peninsula",
    location: "Belmont Shore · Long Beach",
    tagline: "Two private suites between the bay and the Pacific. Roof decks with 360° views. Fifty meters to sand. Walk to 2nd Street.",
    specs: "2 units · 2 BR each · Sleeps 12",
    rating: 4.89,
    reviews: 351,
    url: "peninsula/",
    photo: "images/lgb/rooftop.jpg",
    gradient: "linear-gradient(160deg,#1f2e2c 0%,#0e1a19 100%)",
    status: "active"
  },
  {
    id: "hideout",
    name: "Shankton Hideout",
    location: "Playa Redonda · Nicaragua",
    tagline: "",
    specs: "",
    rating: null,
    reviews: null,
    url: null,
    gradient: "linear-gradient(160deg,#1A332F 0%,#0d1e1c 100%)",
    status: "coming-soon",
    statusLabel: "Coming Back Soon",
    statusNote: "Shankton Hideout — Playa Redonda, Nicaragua. Currently offline."
  }
];

// ── Renderer ─────────────────────────────────────────────────────────────────

(function () {
  const grid   = document.getElementById('collection-grid');
  const teaser = document.getElementById('collection-teaser');
  if (!grid) return;

  const active    = SHANKTON_PROPERTIES.filter(p => p.status === 'active');
  const nonActive = SHANKTON_PROPERTIES.filter(p => p.status !== 'active');

  grid.innerHTML = active.map(p => {
    const img = p.photo
      ? `<img src="${p.photo}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;">`
      : `<div class="property-card-image-placeholder" style="background:${p.gradient};min-height:280px;">
           <span class="eyebrow" style="color:rgba(245,241,232,0.3);">Photo coming</span>
         </div>`;
    return `
    <a href="${p.url}" class="property-card">
      <div class="property-card-image">${img}</div>
      <div class="property-card-body">
        <p class="eyebrow property-card-location">${p.location}</p>
        <h3 class="property-card-name">${p.name}</h3>
        <p class="property-card-tagline">${p.tagline}</p>
        <div class="property-card-meta">
          <div>
            <div class="property-specs">${p.specs}</div>
            <div class="property-card-rating" style="margin-top:4px;">
              <span class="star">★</span> ${p.rating} · ${p.reviews} reviews
            </div>
          </div>
          <span class="property-card-link">View <span>→</span></span>
        </div>
      </div>
    </a>`;
  }).join('');

  if (teaser && nonActive.length) {
    teaser.innerHTML = nonActive.map(p => `
    <div style="margin-top:2px;background:#0f1413;padding:24px;display:flex;align-items:center;justify-content:space-between;gap:24px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <span style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--sand);font-weight:500;border:1px solid rgba(212,185,140,0.3);padding:4px 10px;white-space:nowrap;">${p.statusLabel || 'Coming Soon'}</span>
        <span style="font-size:14px;color:rgba(245,241,232,0.45);">${p.statusNote || p.name + ' — ' + p.location}</span>
      </div>
      <a href="#newsletter" style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(245,241,232,0.3);white-space:nowrap;transition:color 0.15s;" onmouseover="this.style.color='rgba(245,241,232,0.7)'" onmouseout="this.style.color='rgba(245,241,232,0.3)'">Get notified →</a>
    </div>`).join('');
  }
})();
