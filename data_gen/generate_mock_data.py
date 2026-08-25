"""Generate the demo building's unit data.

Footprint + floor count: real, from a specific OSM apartment tower found via a
search for "Prestige Shantiniketan, Whitefield, Bengaluru" (see
fetch_real_building.py / real_building_footprint.json — that file must exist;
run fetch_real_building.py once first, it requires network access to
OpenStreetMap). This particular building carries no `name` tag in OSM's own
data (see fetch_real_building.py's docstring); it's confirmed to be Vaswani
Exquisite Apartments, which is the name used below. Geometry/floor-count are
still 100% real OSM data for a real Bengaluru apartment building regardless.

Everything else is mock, same as before this addendum: unit subdivision within
that real footprint (simple grid, matching the original approach), owner
records, purchase dates, registration status.

Unit footprints are clipped to the real polygon (not just its bounding box) —
see the debug session in CLAUDE.md. The real footprint is irregular (14
exterior vertices, 2 interior holes/courtyards), and a naive minimum-rotated-
-rectangle grid overshot it by ~26% of its area. Each grid cell is now
intersected with the real polygon; the union of all units per floor exactly
reconstructs the real footprint (set identity: union_i(cell_i ∩ P) = P when
the cells tile a rectangle containing P). A cell can end up smaller/irregular,
or be dropped entirely if it falls in a notch/hole with no real overlap.

Run: uv run python data_gen/generate_mock_data.py
Outputs: frontend/public/data/buildingData.geojson
"""

import datetime
import json
import random
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Polygon

from topology_validator import validate_building
from ulpin_generator import BASE_ULPIN, UNIT_LETTERS, generate_unit_ulpin

FOOTPRINT_PATH = Path(__file__).resolve().parent / "real_building_footprint.json"
FLOOR_HEIGHT_M = 3.5
GRID_COLS, GRID_ROWS = 2, 2  # up to 4 units/floor, letters A-D — same layout as before
MIN_UNIT_AREA_M2 = 5.0  # cells clipped smaller than this (slivers) are dropped

METRIC_CRS = "EPSG:32643"  # UTM zone 43N, covers Bengaluru
GEOGRAPHIC_CRS = "EPSG:4326"

OWNER_NAMES = [
    "Ananya Rao", "Vikram Shetty", "Priya Nair", "Arjun Mehta",
    "Kavya Iyer", "Rohan Kulkarni", "Sneha Desai", "Aditya Verma",
    "Meera Pillai", "Karan Malhotra", "Divya Reddy", "Farhan Sheikh",
    "Ishaan Bose", "Lakshmi Menon", "Nikhil Joshi", "Ritu Kapoor",
    "Sanjay Bhatt", "Tanvi Agarwal", "Uday Chauhan", "Zoya Khan",
    "Neha Kulkarni", "Ravi Subramaniam", "Pooja Hegde", "Manish Trivedi",
    "Anjali Pillai", "Siddharth Rao", "Fatima Sheikh", "Devansh Gupta",
    "Kiran Bhat", "Aisha Khan",
]

# Weighted so the registry/dashboard/status-coloring polish has something to
# show — a flat "100% registered" dataset wouldn't exercise it.
STATUS_WEIGHTS = [
    ("Registered", 0.84),
    ("Pending Verification", 0.08),
    ("Disputed / Encumbered", 0.04),
    ("Vacant / Available", 0.04),
]

random.seed(42)


def load_real_footprint():
    if not FOOTPRINT_PATH.exists():
        raise SystemExit(
            f"{FOOTPRINT_PATH} not found. Run data_gen/fetch_real_building.py first "
            "(requires network access to OpenStreetMap)."
        )
    return json.loads(FOOTPRINT_PATH.read_text())


def load_real_polygon_metric(footprint, to_metric):
    """The real footprint as a shapely Polygon in metric meters, holes included."""
    exterior_m = [to_metric.transform(lon, lat) for lon, lat in footprint["exterior_ring_lonlat"]]
    interiors_m = [
        [to_metric.transform(lon, lat) for lon, lat in ring]
        for ring in footprint.get("interior_rings_lonlat", [])
    ]
    return Polygon(exterior_m, interiors_m)


def compute_oriented_grid(real_polygon_m):
    """Minimum rotated rectangle of the real footprint, as an (origin, edge_u,
    edge_v) basis in metric meters — lets the unit grid follow the real
    building's actual orientation instead of the lon/lat axes. This rectangle
    is only the grid's reference frame; each cell gets clipped to the real
    polygon below, so the rectangle itself is never rendered."""
    obb = real_polygon_m.minimum_rotated_rectangle
    corners = list(obb.exterior.coords)[:4]

    ox0, oy0 = corners[0]
    edge_u = (corners[1][0] - ox0, corners[1][1] - oy0)
    edge_v = (corners[3][0] - ox0, corners[3][1] - oy0)
    return (ox0, oy0), edge_u, edge_v


def grid_cell_polygon_metric(origin, edge_u, edge_v, col, row, cols, rows):
    ox0, oy0 = origin
    ux, uy = edge_u
    vx, vy = edge_v

    def point(u, v):
        return (ox0 + u * ux + v * vx, oy0 + u * uy + v * vy)

    u0, u1 = col / cols, (col + 1) / cols
    v0, v1 = row / rows, (row + 1) / rows
    return Polygon([point(u0, v0), point(u1, v0), point(u1, v1), point(u0, v1), point(u0, v0)])


def clip_cell_to_real_polygon(cell_polygon_m, real_polygon_m):
    """Intersect a grid cell with the real footprint. Returns a Polygon
    (interior holes kept — see build_units, they're rendered as real holes,
    not dropped; largest part kept if the clip splits into disjoint pieces),
    or None if the cell has no meaningful overlap with the real building."""
    clipped = cell_polygon_m.intersection(real_polygon_m)

    if clipped.geom_type == "MultiPolygon":
        clipped = max(clipped.geoms, key=lambda g: g.area)
    if clipped.geom_type != "Polygon" or clipped.is_empty:
        return None
    if clipped.area < MIN_UNIT_AREA_M2:
        return None

    return clipped


def _random_purchase_date() -> str:
    start = datetime.date(2019, 1, 1)
    end = datetime.date(2025, 12, 31)
    delta_days = (end - start).days
    d = start + datetime.timedelta(days=random.randint(0, delta_days))
    return d.isoformat()


def build_units(footprint):
    floors = footprint["levels"]
    to_metric = Transformer.from_crs(GEOGRAPHIC_CRS, METRIC_CRS, always_xy=True)
    to_geo = Transformer.from_crs(METRIC_CRS, GEOGRAPHIC_CRS, always_xy=True)

    real_polygon_m = load_real_polygon_metric(footprint, to_metric)
    origin, edge_u, edge_v = compute_oriented_grid(real_polygon_m)

    # Clip each (col, row) cell once against the real footprint — the same
    # horizontal shape is reused for every floor, only z_min/z_max change.
    # A cell entirely outside the real footprint (e.g. in a notch) is skipped
    # on every floor, so some floors may end up with fewer than 4 units.
    def ring_to_lonlat(coords):
        return [[round(lon, 6), round(lat, 6)] for lon, lat in (to_geo.transform(x, y) for x, y in coords)]

    # (exterior ring, [hole rings]) per cell — GeoJSON Polygon coordinates are
    # [exterior, hole1, hole2, ...], and Cesium natively renders polygon holes,
    # so a cell whose clip retains a courtyard hole keeps it as a real hole
    # rather than silently filling it in solid.
    cell_polygons_lonlat = {}
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            cell_polygon_m = grid_cell_polygon_metric(origin, edge_u, edge_v, col, row, GRID_COLS, GRID_ROWS)
            clipped = clip_cell_to_real_polygon(cell_polygon_m, real_polygon_m)
            if clipped is None:
                continue
            rings_lonlat = [ring_to_lonlat(clipped.exterior.coords)]
            rings_lonlat += [ring_to_lonlat(hole.coords) for hole in clipped.interiors]
            cell_polygons_lonlat[(col, row)] = rings_lonlat

    owner_pool = list(OWNER_NAMES)
    random.shuffle(owner_pool)
    statuses = [s for s, _ in STATUS_WEIGHTS]
    weights = [w for _, w in STATUS_WEIGHTS]

    units = []
    idx = 0
    for floor in range(1, floors + 1):
        z_min = (floor - 1) * FLOOR_HEIGHT_M
        z_max = floor * FLOOR_HEIGHT_M
        for row in range(GRID_ROWS):
            for col in range(GRID_COLS):
                rings_lonlat = cell_polygons_lonlat.get((col, row))
                if rings_lonlat is None:
                    continue

                letter = UNIT_LETTERS[row * GRID_COLS + col]
                ulpin = generate_unit_ulpin(floor, letter)

                status = random.choices(statuses, weights=weights, k=1)[0]
                if status == "Vacant / Available":
                    owner = "Unallotted / Developer Inventory"
                    purchase_date = None
                else:
                    owner = owner_pool[idx % len(owner_pool)]
                    purchase_date = _random_purchase_date()
                idx += 1

                units.append({
                    "type": "Feature",
                    "properties": {
                        "id_3d_ulpin": ulpin,
                        "base_ulpin": BASE_ULPIN,
                        "floor": floor,
                        "unit_letter": letter,
                        "z_min": z_min,
                        "z_max": z_max,
                        "owner_name": owner,
                        "purchase_date": purchase_date,
                        "status": status,
                        "source": "mock",
                        "geometry_source": "real",
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": rings_lonlat,
                    },
                })
    return units


def main():
    footprint = load_real_footprint()
    units = build_units(footprint)

    feature_collection = {
        "type": "FeatureCollection",
        "building": {
            "name": f"Vaswani Exquisite Apartments ({footprint['osm_element']}/{footprint['osm_id']})",
            "base_ulpin": BASE_ULPIN,
            "footprint_source": "real",
            "floor_count_source": "real",
            "osm_element": footprint["osm_element"],
            "osm_id": footprint["osm_id"],
            "levels": footprint["levels"],
            "footprint_area_m2": footprint["area_m2"],
            "real_footprint_lonlat": footprint["exterior_ring_lonlat"],
        },
        "features": units,
    }

    ok, errors = validate_building(feature_collection)
    if not ok:
        raise SystemExit("Topology validation failed:\n" + "\n".join(errors))

    out_path = (
        Path(__file__).resolve().parent.parent
        / "frontend" / "public" / "data" / "buildingData.geojson"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(feature_collection, indent=2))
    print(f"Validated OK. Wrote {len(units)} units across {footprint['levels']} floors to {out_path}")


if __name__ == "__main__":
    main()
