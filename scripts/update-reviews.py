#!/usr/bin/env python3
"""Refresh Airbnb rating + review counts across the site.

Run nightly by .github/workflows/update-reviews.yml. Stdlib only.

Sources:
  - Airbnb listing page (public): starRating + reviewCount — what guests see.
  - Hospitable API (optional, HOSPITABLE_TOKEN): % of Airbnb reviews that are 5★.

Targets:
  - <span data-rv="{prop}-rating|count|five">…</span> in any .html file
  - aggregateRating JSON-LD on each property's own page
  - rating/reviews in js/properties.js

Any fetch/parse/sanity failure leaves that property untouched (exit 0),
so a blocked request never writes bad numbers.
"""
import glob
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PROPS = {
    'harbour':   {'airbnb': '16404736', 'hospitable': ['c14d1f89-cbac-499c-a4aa-f2b0e8f2278e'], 'page': 'harbour/index.html'},
    'tower':     {'airbnb': '20946547', 'hospitable': ['9c4ac1ba-6bc9-40b6-9f8e-0d6d18ea39e5'], 'page': 'tower/index.html'},
    'peninsula': {'airbnb': '41775575', 'hospitable': ['c4a7f5ea-4ad5-4051-91c0-e72573fc21ba'], 'page': 'peninsula/index.html'},
}

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130.0 Safari/537.36')


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with open(os.path.join(ROOT, path), 'w', encoding='utf-8') as f:
        f.write(text)


def airbnb_stats(listing_id):
    req = urllib.request.Request(f'https://www.airbnb.com/rooms/{listing_id}',
                                 headers={'User-Agent': UA, 'Accept-Language': 'en-US'})
    html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    rating = re.search(r'"starRating":(\d\.\d+)', html)
    count = re.search(r'"visibleReviewCount":"?(\d+)', html) or re.search(r'"reviewCount":(\d+)', html)
    if not rating or not count:
        raise ValueError('rating/count not found in page')
    return f'{float(rating.group(1)):.2f}', count.group(1)


def five_star_pct(property_ids, token):
    ratings = []
    for pid in property_ids:
        page = 1
        while True:
            req = urllib.request.Request(
                f'https://public.api.hospitable.com/v2/properties/{pid}/reviews?per_page=100&page={page}',
                headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'})
            data = json.load(urllib.request.urlopen(req, timeout=30))
            ratings += [r['public']['rating'] for r in data['data']
                        if r.get('platform') == 'airbnb' and r['public'].get('rating') is not None]
            if page >= data['meta']['last_page']:
                break
            page += 1
    if not ratings:
        raise ValueError('no Airbnb ratings')
    return str(round(100 * sum(1 for r in ratings if r == 5) / len(ratings)))


def current(prop, kind):
    for path in glob.glob(os.path.join(ROOT, '**/*.html'), recursive=True):
        m = re.search(rf'data-rv="{prop}-{kind}">([^<]*)<', read(os.path.relpath(path, ROOT)))
        if m:
            return m.group(1)
    return None


def main():
    token = os.environ.get('HOSPITABLE_TOKEN')
    updates = {}  # (prop, kind) -> value

    for prop, cfg in PROPS.items():
        try:
            rating, count = airbnb_stats(cfg['airbnb'])
        except Exception as e:  # noqa: BLE001 — never fail the job on a blocked fetch
            print(f'{prop}: Airbnb fetch failed ({e}); leaving as is')
            continue
        old_count = int(current(prop, 'count') or 0)
        if not (4.0 <= float(rating) <= 5.0) or not (old_count <= int(count) <= old_count + 60):
            print(f'{prop}: implausible {rating}/{count} (was {old_count}); leaving as is')
            continue
        updates[(prop, 'rating')] = rating
        updates[(prop, 'count')] = count
        if token:
            try:
                updates[(prop, 'five')] = five_star_pct(cfg['hospitable'], token)
            except Exception as e:  # noqa: BLE001
                print(f'{prop}: five-star % failed ({e})')
        print(f'{prop}: {rating} · {count} reviews')

    if not updates:
        return 0

    # Tagged spans in every page
    for path in glob.glob(os.path.join(ROOT, '**/*.html'), recursive=True):
        rel = os.path.relpath(path, ROOT)
        if rel.startswith(('_template', 'node_modules')):
            continue
        text = new = read(rel)
        for (prop, kind), val in updates.items():
            new = re.sub(rf'(data-rv="{prop}-{kind}">)[^<]*(<)', rf'\g<1>{val}\g<2>', new)
        if new != text:
            write(rel, new)

    # JSON-LD aggregateRating + properties.js
    props_js = read('js/properties.js')
    for prop, cfg in PROPS.items():
        if (prop, 'rating') not in updates:
            continue
        r, c = updates[(prop, 'rating')], updates[(prop, 'count')]
        page = read(cfg['page'])
        page = re.sub(r'("aggregateRating"[\s\S]*?"ratingValue":\s*")[^"]*', rf'\g<1>{r}', page, count=1)
        page = re.sub(r'("aggregateRating"[\s\S]*?"reviewCount":\s*")[^"]*', rf'\g<1>{c}', page, count=1)
        write(cfg['page'], page)
        props_js = re.sub(rf'(id: "{prop}"[\s\S]*?rating: )[\d.]+(,\s*reviews: )\d+',
                          rf'\g<1>{r}\g<2>{c}', props_js, count=1)
    write('js/properties.js', props_js)
    return 0


if __name__ == '__main__':
    sys.exit(main())
