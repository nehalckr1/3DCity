# VertiCadastre — 3D ULPIN Mini Demo

SIH 2026 PS 26011 selection-round demo. Full brief: `README.md`.

## Run it

```bash
uv run python data_gen/fetch_real_building.py  # once, needs network: caches real_building_footprint.json
uv run python data_gen/generate_mock_data.py   # regenerate frontend/public/data/buildingData.geojson
cd frontend && npm install && npm run dev      # http://localhost:5173
```

## Structure

- `data_gen/` — building generator (Python + shapely/geopandas/osmnx).
  - `fetch_real_building.py` — one-time, network-dependent: queries OSM for Prestige
    Shantiniketan (Whitefield, Bengaluru — a large real complex, 33 separate building
    footprints), picks one real apartment tower (tallest, ties broken toward `relation` type
    then largest area — currently resolves to `relation/14434977`, 24 real floors), caches it
    to `real_building_footprint.json`. See its docstring for why one tower, not the whole
    campus.
  - `generate_mock_data.py` — reads that cached footprint (exterior ring + 2 interior holes —
    real courtyards/light-wells), builds a 2×2 grid oriented to the footprint's minimum rotated
    rectangle, then **clips each grid cell to the real polygon** (shapely intersection) instead
    of rendering the rectangle itself — see "Debug: footprint alignment" below, this clipping is
    the actual fix. Writes `frontend/public/data/buildingData.geojson` (96 units — 24 real
    floors × 4 mock units/floor; a cell with no real overlap on any floor would be dropped, none
    were for this tower). Per unit: `geometry_source: "real"` (footprint + floor count are real
    OSM data) vs `source: "mock"` (owner/purchase-date/status are fictional). Also assigns a
    mock `status` (Registered/Pending Verification/Disputed/Vacant, weighted so the
    dashboard/registry have variety).
  - `ulpin_generator.py` builds IDs (`KA-BLR-00042-F05-U03`), `topology_validator.py` checks
    containment/no-overlap (shape-agnostic, works on the real footprint the same as the old
    hardcoded rectangle).
- `frontend/` — Vite + CesiumJS, plain JS (no framework). `src/main.js` loads the GeoJSON,
  extrudes each unit color-coded by `status` (not floor), anchors the camera to the building's
  centroid via `camera.lookAtTransform` so drag orbits the building, draws the ground grid +
  real OSM outline reference, shows a real/mock badge in the title bar. `unitInfoPanel.js` is
  the click popup (status badge, footprint/owner-record source); `search.js` flies to/highlights
  a unit by ULPIN; `conflictDemo.js` injects an overlapping claim against
  `KA-BLR-00042-F03-U02` and flags the conflict (now typically flags 2 adjacent units, since the
  real footprint's rotated grid means an eastward shift crosses more than one cell — still a
  correct overlap detection, just not single-target like the old axis-aligned rectangle).
  `registryTable.js`, `dashboard.js`, `certificate.js` (QR via the `qrcode` package), and
  `ulpinGuide.js` are modal overlays ported from a teammate's separate Three.js/Leaflet
  prototype (`~/Downloads/index.html` + `data.js`) — feature ideas only, not their code.
- `db.py` — PostGIS wiring stub, not live. See its docstring.

## Status

Checkpoints 1–4 complete and verified end-to-end (Playwright smoke test: click, search,
conflict demo all functioning). Also added: registry table (filter + CSV export), analytics
dashboard (unit/floor/owner counts + live conflicts-detected counter), per-unit printable
certificate with QR code, and a ULPIN-format guide modal — all verified via the same Playwright
flow. Remaining "if time remains" items (real OSM footprint, live backend) are not started —
see README for that list and its ordering.

Fixed after initial user testing:
- Camera couldn't orbit the building (default Cesium ground-navigation drag was panning across
  the basemap instead of rotating around it, near-zero heading/pitch change on drag). Fixed by
  anchoring the camera with `camera.lookAtTransform` at the building's centroid in `main.js`
  instead of relying on default globe navigation.
- The building sat on real OpenStreetMap imagery of Whitefield, Bengaluru, which made the
  (at the time fully fictional) building look like it was misrepresenting a real place. Removed
  the real basemap (`baseLayer: false`) in favor of a neutral dark grid. Restored once the
  addendum below made the footprint/location genuinely real — real imagery now reinforces
  credibility instead of undermining it. The neutral grid ground rectangle was removed again
  (redundant/cluttered on top of real street imagery); the real-OSM-outline reference polyline
  stays.

## Addendum: real footprint + visual polish

Swapped the hardcoded fictional 5-floor/20-unit rectangle for a real OSM apartment tower's
footprint and real floor count (24 floors → 96 units), per user decision: one real tower (not
the whole 33-building campus), real floor count (not capped). Also: color-by-status instead of
color-by-floor, thinner default outlines with white hover-highlight, opacity bumped to 0.88,
and the fixed default camera range is now computed from the building's actual size (was a
magic number tuned for the old tiny building). `search.js`'s fly-to offset range also had to
be bumped (60m → 90m) — the old value flew the camera inside the much taller real tower's own
mass.

## Debug: footprint alignment (2026-08-25)

Reported: the 3D building didn't sit correctly over the real plot. Root cause, found by
computing IoU (intersection-over-union) between the real OSM polygon and the rendered footprint
in a metric CRS: `compute_oriented_grid`'s unit grid was built directly from
`polygon.minimum_rotated_rectangle` — a bounding-box approximation, not the real (irregular,
14-vertex, 2-interior-hole) polygon. IoU was **0.738**, with 26% of the rendered footprint
sitting outside the real building's actual outline. Geocode (Step 1) and coordinate order
(Step 3, `[lon, lat]` throughout, traced with an explicit print comparing raw GeoJSON to the
decoded Cesium entity position) were both confirmed correct, not the cause. Data wiring (Step 4)
was also confirmed correct — the bug was purely in how the fetched real polygon was turned into
render geometry (Step 2, exactly as suspected).

Fix: `fetch_real_building.py` now also saves the polygon's interior rings (it has 2 — real
courtyards). `generate_mock_data.py` clips each grid cell against the real polygon via shapely
`.intersection()` (keeping holes, not dropping them) instead of using the raw bounding-rectangle
cell. This is provably exact — the union of clipped cells reconstructs the real polygon exactly,
since the cells tile a rectangle that contains it. Verified IoU **0.999** post-fix (residual is
rounding from 6-decimal-degree coordinate storage, ~0.1m). `main.js` was updated to render
polygon holes natively (`Cesium.PolygonHierarchy` with holes) for correctness if a future tower
choice has a hole fully enclosed within one unit cell — not needed for the current tower (its
holes get cut into notches across cell boundaries instead), but wired up for robustness since
the backend now emits real hole rings whenever they occur. Confirmed visually via a top-down
camera view: the rendered silhouette now shows the same irregular notched shape (including the
2 courtyard cutouts) as the real building.

A follow-up sanity check (re-derive the real polygon's centroid, the generated file's rendered
centroid, and the *live on-screen* Cesium entities' centroid — all independently, all
area-weighted) confirmed the fix holds: all three agree to within ~3mm.

## Naming correction (2026-08-25)

The debug session above initially claimed the OSM basemap tile labeled this exact footprint
"Vaswani Exquisite Apartments" — that was taken from a screenshot at face value, not verified.
Checked properly before renaming anything: `relation/14434977` (our tower) has **no `name` tag
in OSM's own data** (confirmed via `row.get('name')` → `nan`). The visible basemap label wasn't
attached to our polygon. What OSM *does* confirm in the same query result set: real named
buildings from an actual "Prestige Shantiniketan" complex sitting right there — `Prestige
Shantiniketan Commercial Complex`, `Tower 1/2/3`, `Block A/B/C` — so our tower is plausibly an
unnamed residential tower within that real complex (OSM's per-building tagging inside large
complexes is often incomplete even when the complex itself is well-mapped).

Renamed to "Vaswani Exquisite Apartments" anyway, per direct confirmation — not an OSM tag,
but real-world knowledge of the building. Geometry/floor-count remain 100% real OSM data
regardless of which name is used to describe it; only the display `name` field changed
(`generate_mock_data.py`'s `building.name`). Docstrings in `fetch_real_building.py` and
`generate_mock_data.py` state plainly what's an OSM tag vs. confirmed separately, so this
doesn't get miscited as OSM-verified again.
