#!/usr/bin/env python3
import os, subprocess, string

ROOT = "/Users/picklerick/shankton-website"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CARDS = [
    dict(slug="tower", photo="images/nica/tower/pool-infinity.jpg",
         eyebrow="PLAYA GIGANTE · NICARAGUA", title="Shankton Tower",
         tagline="Four floors over the Pacific. Cliff-edge pool. Sleeps twelve.",
         specs="4 BR + BUNK · 4 BA · SLEEPS 12 · FROM $385/NIGHT",
         rating="★ 4.79 · 293 REVIEWS · 84% FIVE-STAR"),
    dict(slug="harbour", photo="images/nica/harbour/pool-chairs-sunny.jpg",
         eyebrow="PLAYA GIGANTE · NICARAGUA", title="Shankton Harbour",
         tagline="The only home in Gigante with its own sea shelf.",
         specs="3 BR · 3.5 BA · SLEEPS 8 · FROM $325/NIGHT",
         rating="★ 4.87 · 279 REVIEWS · 90% FIVE-STAR"),
    dict(slug="peninsula", photo="images/lgb/a/rooftop-full.jpg",
         eyebrow="BELMONT SHORE · LONG BEACH, CA", title="Shankton Peninsula",
         tagline="Two suites. Roof decks. Fifty meters to sand.",
         specs="UNIT A 2BR · UNIT B 3BR · SLEEPS 6 EACH",
         rating="★ 4.89 · 354 REVIEWS · 9.9/10 ON BOOKING"),
    dict(slug="nicaragua", photo="images/nica/tower/pool-terrace-view.jpg",
         eyebrow="PACIFIC COAST · NICARAGUA", title="Where the water runs emerald.",
         tagline="",
         specs="HARBOUR · TOWER · PLAYA GIGANTE",
         rating="568+ reviews · Same crew for a decade"),
    dict(slug="california", photo="images/lgb/a/rooftop-skyline.jpg",
         eyebrow="BELMONT SHORE · LONG BEACH, CA", title="Between the bay and the Pacific.",
         tagline="",
         specs="SHANKTON PENINSULA · 2 UNITS · SLEEPS 12",
         rating="4.89★ · 9.9/10 on Booking · 50m to sand"),
    dict(slug="home", photo="images/nica/harbour/deck-cove-sunny.jpg",
         eyebrow="SHANKTON PROPERTIES", title="Where the Pacific runs emerald.",
         tagline="Rare places, pro tips, local hosts.",
         specs="NICARAGUA  ·  CALIFORNIA",
         rating=""),
]

TPL = string.Template("""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1200px; height:630px; overflow:hidden; }
  .card { position:relative; width:1200px; height:630px; background:#060c08; font-family:Georgia,'Times New Roman',serif; }
  .photo { position:absolute; inset:0; background:url('file://$photo') center/cover no-repeat; }
  .scrim { position:absolute; inset:0; background:
     linear-gradient(102deg, rgba(6,12,8,0.96) 0%, rgba(6,12,8,0.90) 28%, rgba(6,12,8,0.58) 60%, rgba(6,12,8,0.22) 100%),
     linear-gradient(0deg, rgba(6,12,8,0.55) 0%, rgba(6,12,8,0) 40%); }
  .bar { position:absolute; left:0; top:0; bottom:0; width:6px; background:#3A6560; }
  .content { position:absolute; left:120px; top:0; height:630px; width:640px; display:flex; flex-direction:column; justify-content:center; }
  .logo { margin-bottom:34px; }
  .eyebrow { font-size:13px; letter-spacing:5px; color:#D4B98C; margin-bottom:22px; }
  .title { font-size:${titlesize}px; line-height:1.04; color:#F5F1E8; letter-spacing:-1px; font-weight:normal; }
  .tagline { font-size:22px; color:rgba(245,241,232,0.72); margin-top:26px; line-height:1.4; max-width:560px; }
  .divider { width:60px; height:2px; background:#3A6560; margin:30px 0 26px; }
  .specs { font-size:16px; letter-spacing:3px; color:#8FB0AB; }
  .rating { font-size:15px; letter-spacing:2px; color:#D4B98C; margin-top:16px; }
  .site { position:absolute; right:56px; bottom:40px; font-size:14px; letter-spacing:1px; color:rgba(245,241,232,0.55); }
</style></head><body>
  <div class="card">
    <div class="photo"></div>
    <div class="scrim"></div>
    <div class="bar"></div>
    <div class="content">
      <svg class="logo" width="52" height="66" viewBox="0 0 56 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="28,0 48,18 48,52 28,72 8,52 8,18" fill="#1A332F"/>
        <polygon points="28,0 48,18 28,24" fill="#3A6560"/>
        <polygon points="28,0 8,18 28,24" fill="#2A4A45"/>
        <polygon points="8,52 28,24 28,72" fill="#3A6560" opacity="0.8"/>
        <polygon points="28,24 8,18 48,18" fill="#4A7570" opacity="0.6"/>
      </svg>
      <div class="eyebrow">$eyebrow</div>
      <div class="title">$title</div>
      $tagline_html
      <div class="divider"></div>
      <div class="specs">$specs</div>
      $rating_html
    </div>
    <div class="site">shankton.com</div>
  </div>
</body></html>""")

for c in CARDS:
    photo_abs = os.path.join(ROOT, c["photo"])
    titlesize = 58 if len(c["title"]) <= 22 else 52
    tagline_html = f'<div class="tagline">{c["tagline"]}</div>' if c["tagline"] else ""
    rating_html = f'<div class="rating">{c["rating"]}</div>' if c["rating"] else ""
    html = TPL.substitute(photo=photo_abs, eyebrow=c["eyebrow"], title=c["title"],
                          titlesize=titlesize, tagline_html=tagline_html,
                          specs=c["specs"], rating_html=rating_html)
    htmlpath = f"/tmp/og_{c['slug']}.html"
    pngpath = f"/tmp/og_{c['slug']}.png"
    jpgpath = os.path.join(ROOT, f"img/og-{c['slug']}.jpg")
    with open(htmlpath, "w") as f:
        f.write(html)
    subprocess.run([CHROME, "--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--window-size=1200,630", f"--screenshot={pngpath}", f"file://{htmlpath}"],
                   check=True, capture_output=True)
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "88", pngpath, "--out", jpgpath],
                   check=True, capture_output=True)
    dims = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", jpgpath],
                          capture_output=True, text=True).stdout
    w = [l.split(":")[1].strip() for l in dims.splitlines() if "pixelWidth" in l]
    h = [l.split(":")[1].strip() for l in dims.splitlines() if "pixelHeight" in l]
    sz = os.path.getsize(jpgpath) // 1024
    print(f"  ok  og-{c['slug']}.jpg  {w[0]}x{h[0]}  {sz}KB")

print("done")
