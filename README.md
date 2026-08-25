# VertiCadastre — 3D ULPIN Mini Demo
### SIH 2026 · PS 26011 · Build Brief for Claude Code — SELECTION ROUND SCOPE

## Read this first

**This is for an internal selection round, not the SIH finale.** The bar is: a small,
reliably-working, visually convincing demo that communicates the idea clearly — not a
production-grade or fully data-engineered system. You have up to 2 days, but the target is
"finish early and polish" rather than "use all 2 days building infrastructure."

**This is our own original build direction — CesiumJS for 3D, PostGIS-ready but not required
to be wired live for this round.** (An earlier draft explored aligning to a teammate's
React/Three.js plan instead — that direction has been dropped; build against this spec only.)

**Cut aggressively. In priority order, if something is slow or breaking, cut it in this order
first:** live PostGIS wiring → real OSM data pull → any backend at all → novelty features.
The 3D view + click-to-see-ID + search is the one thing that must not be cut.

**Stop and ask the user (do not guess and proceed) whenever you hit any of these:**
- A library fails to install and there are multiple plausible fixes
- You're more than ~2 hours into any single checkpoint below with no visible progress —
  check in rather than keep pushing
- You're about to start anything under "Explicitly out of scope" below
- Real data (OSM footprint) doesn't match expectations — don't silently substitute a
  different building without confirming with the user

Otherwise, proceed autonomously.

---

## What this demo needs to communicate (the actual goal)

In under 2 minutes of clicking through it, a judge should understand: "this team extends 2D
land records into 3D by giving every floor/unit its own linked ID, and can automatically
detect ownership conflicts." That's it. Everything else is in service of that.

## Demo target — simplified

- Building: a **hardcoded fictional 5-storey, 20-unit building** for this round. Do NOT spend
  time on a real OSM data pull unless Checkpoints 1–4 are fully done with time to spare (see
  "If time remains"). Real-data grounding is fine to *mention* in the pitch as a roadmap
  item, not something required for this demo.
- Base ULPIN format: `KA-BLR-00042`, extended per unit as `KA-BLR-00042-F05-U03`.

---

## Tech stack — simplified for speed, but keeping our original choices

- **3D visualization:** CesiumJS, served via a Vite dev server (plain JS, no React needed for
  this round — don't add a frontend framework just for structure; keep it lean).
- **Data:** a single static JSON/GeoJSON file, generated once by a small Python script and
  loaded directly by the Cesium frontend. **No live backend required** for this round — skip
  FastAPI/Flask unless the core demo is fully working with time left over.
- **No live PostgreSQL/PostGIS wiring required** for this round — `sih_3dCity` can stay as-is
  for now. The schema/pipeline should still be *designed* to plug into PostGIS later (keep
  `db.py` as a stub/optional module), since that's a legitimate "production path" talking
  point for the pitch, but don't spend build time getting it actually running live unless
  Checkpoints 1–4 are solid first.

---

## Project structure

```
verticadastre-mini/
├── CLAUDE.md
├── data_gen/
│   ├── generate_mock_data.py   # run once, outputs frontend/data/buildingData.geojson
│   ├── ulpin_generator.py      # ID generation logic
│   └── topology_validator.py   # overlap/containment checks
├── db.py                        # optional stub — PostGIS wiring path, not required to run
└── frontend/
    ├── package.json             # Vite project
    ├── index.html
    └── src/
        ├── main.js               # Cesium scene setup, loads buildingData.geojson
        ├── unitInfoPanel.js      # click handler -> shows ULPIN, owner, floor/unit
        ├── search.js             # search bar -> highlight unit
        └── conflictDemo.js       # button that injects + flags a conflict, live
```

---

## Checkpoint 1 — Generate mock data (target: under 1 hour)

`data_gen/generate_mock_data.py`:
- Hardcode a 5-storey, 4-units-per-floor building (20 units total).
- For each unit generate: `id_3d_ulpin` (via `ulpin_generator.py`), floor number, unit
  letter, a simple rectangular footprint (can be arbitrary local coordinates — real-world
  georeferencing is a bonus, not required this round), height range (`z_min`/`z_max`), a
  fictional owner (name + purchase date), and `source: "mock"`.
- `topology_validator.py`: confirm every unit is contained in its floor and no two units on
  the same floor overlap (`shapely` is fine to use here for the geometry checks even though
  PostGIS itself isn't wired live).
- Output as `buildingData.geojson`.
- **Definition of done:** a GeoJSON file with 20 well-formed, validated unit records.

## Checkpoint 2 — 3D view in CesiumJS (target: the bulk of day 1 — most important checkpoint)

- `main.js`: load `buildingData.geojson`, render each unit as an extruded 3D shape stacked
  at its floor's height range. Color-code by floor.
- Clicking a unit shows `unitInfoPanel.js` output: ULPIN, owner, floor/unit.
- **This is the single most important visual piece — allocate the most time here, and get a
  basic version (even with placeholder/dummy shapes) working before Checkpoint 1's data
  generator is fully polished, so you have visual proof-of-life early.**
- **Definition of done:** an interactive, rotatable 3D building in the browser, every unit
  clickable and showing its ID + owner.

## Checkpoint 3 — Search (target: an hour or two)

- `search.js`: a text input; on submit, find the matching unit in the loaded data and
  highlight/fly-to it in the Cesium view.
- **Definition of done:** typing a valid ULPIN highlights the correct unit in the 3D scene.

## Checkpoint 4 — Conflict detection demo (target: a couple hours — this is your novelty hook)

- `conflictDemo.js`: a button labeled something like "Simulate competing claim" that
  programmatically creates a second, overlapping unit geometry and runs an overlap check
  (reuse the same logic style as `topology_validator.py`, ported to JS or precomputed and
  just triggered client-side — whichever is faster to build) against existing units, then
  visibly flags the conflicting units in the 3D view (e.g. turns them red) with a message
  like "Ownership conflict detected: Unit F03-U02 overlaps with a newly submitted claim."
- This is the single feature that differentiates this from a plain "records viewer" pitch —
  prioritize it over polish elsewhere once Checkpoints 1–3 work.
- **Definition of done:** clicking the button visibly and correctly triggers a conflict flag
  on screen, live.

## If time remains after Checkpoints 1–4 are solid

Only attempt these in order, and only once 1–4 are fully working and demoed successfully
end-to-end at least once:
1. Pull one real building footprint via `osmnx` (target: Prestige Shantiniketan, Whitefield,
   Bengaluru — confirm with user if OSM data for it is missing/unusable) and swap in real
   coordinates/shape for the building outline — makes the "real data" claim demonstrably
   true rather than just asserted in the pitch.
2. A minimal dashboard/stats readout (unit count, floors, conflicts detected) as a simple
   overlay panel in the Cesium view.
3. Wire up a minimal backend (FastAPI) and the existing `sih_3dCity` PostGIS database for
   real, if genuinely useful — not required. If attempted, do not touch the database
   connection setup beyond what's already configured; ask the user if it fails.

Do not attempt live PostGIS wiring or a full backend before Checkpoints 1–4 are done and
demoed.

---

## Explicitly out of scope for this round

- Live PostgreSQL/PostGIS wiring (design-only/stub is fine, see `db.py`)
- FastAPI/backend server (unless everything else is done early)
- Real drone/LiDAR/satellite imagery, CV footprint extraction
- Ownership records table/filters, full dashboard, multi-building support
- React or any frontend framework — keep this round's frontend plain JS + Vite + Cesium
- Authentication, deployment, anything production-related

---

## Working style expectations

- Get Checkpoint 2 (the 3D view) showing *something* — even with placeholder dummy shapes —
  before Checkpoint 1's data generator is fully polished. Visual proof of life matters most,
  earliest.
- After each checkpoint, confirm it actually works by running it, not just writing the code.
- If running low on time, a working Checkpoint 1–3 with no Checkpoint 4 is a fine outcome —
  say so plainly rather than half-building the conflict demo and leaving it broken.
- Rehearse the click-through demo flow once fully working, out loud, before considering this
  done.
x