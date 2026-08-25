"""Fetch a real building footprint from OpenStreetMap for the demo building.

Run once (network required): uv run python data_gen/fetch_real_building.py
Writes: data_gen/real_building_footprint.json (cached, offline-reproducible from
there on — generate_mock_data.py reads this file, not the network).

Selection: Prestige Shantiniketan, Whitefield, Bengaluru is a large real complex
(OSM returns 33 separate building footprints within 300m of the address, not one
polygon). We pick a single representative tower rather than modeling the whole
campus, to keep the existing single-building data model/rendering intact (see
addendum decision — user chose "one real tower, keep single-building
architecture" and "use its real floor count").

Selection rule, applied over buildings with a numeric `building:levels` tag:
tallest first (building:levels desc); ties broken by preferring an OSM
`relation` (multipolygon, generally more carefully mapped) over a `way`, then
by largest footprint area. Restricted to building=apartments so the result
reads as a residential tower (matches the owner/purchase-date unit records).

Note: the tower this currently resolves to (relation/14434977) has no `name`
tag in OSM's own data for this specific building — common for individual
towers within a large complex, OSM's building-level tagging is often
incomplete even when the complex itself is well-mapped (this search area also
returns real named buildings like "Prestige Shantiniketan Commercial
Complex", "Tower 1/2/3", "Block A/B/C"). The building is confirmed to be
Vaswani Exquisite Apartments; generate_mock_data.py uses that as the display
name. The geometry/floor-count are still 100% real OSM data for this exact
building regardless of what name is shown for it.
"""

import json
from pathlib import Path

import osmnx as ox
import pandas as pd

PLACE_QUERY = "Prestige Shantiniketan, Whitefield, Bengaluru, India"
SEARCH_DIST_M = 300
OUT_PATH = Path(__file__).resolve().parent / "real_building_footprint.json"


def fetch_candidates():
    gdf = ox.features_from_address(PLACE_QUERY, tags={"building": True}, dist=SEARCH_DIST_M)
    gdf = gdf[gdf["building"] == "apartments"]
    gdf = gdf[gdf["building:levels"].notna()]
    if gdf.empty:
        raise SystemExit(
            f"No apartment buildings with a known floor count found near '{PLACE_QUERY}'. "
            "Stop and confirm with the user before substituting something else."
        )
    return gdf


def select_tower(gdf_wgs84):
    """Rank candidates and return (index, area_m2) of the chosen tower."""
    gdf_metric = gdf_wgs84.to_crs(epsg=32643)
    ranking = pd.DataFrame(
        {
            "levels": gdf_wgs84["building:levels"].astype(float),
            "is_relation": gdf_wgs84.index.get_level_values("element") == "relation",
            "area_m2": gdf_metric.geometry.area,
        },
        index=gdf_wgs84.index,
    ).sort_values(["levels", "is_relation", "area_m2"], ascending=[False, False, False])

    chosen_idx = ranking.index[0]
    return chosen_idx, float(ranking.iloc[0]["area_m2"])


def main():
    gdf_wgs84 = fetch_candidates()
    chosen_idx, area_m2 = select_tower(gdf_wgs84)
    chosen_wgs84 = gdf_wgs84.loc[chosen_idx]

    polygon = chosen_wgs84.geometry
    exterior_ring = [[round(lon, 6), round(lat, 6)] for lon, lat in polygon.exterior.coords]
    # Real buildings often aren't solid rectangles — this one has 2 interior
    # holes (courtyards/light-wells). Keep them: dropping interiors was the
    # main reason the earlier bounding-box-based render didn't sit exactly on
    # the real footprint (see debug session that found this).
    interior_rings = [
        [[round(lon, 6), round(lat, 6)] for lon, lat in interior.coords]
        for interior in polygon.interiors
    ]

    result = {
        "osm_element": chosen_idx[0],
        "osm_id": int(chosen_idx[1]),
        "building_tag": chosen_wgs84["building"],
        "levels": int(float(chosen_wgs84["building:levels"])),
        "area_m2": round(area_m2, 1),
        "exterior_ring_lonlat": exterior_ring,
        "interior_rings_lonlat": interior_rings,
        "source": "OpenStreetMap",
        "place_query": PLACE_QUERY,
    }

    OUT_PATH.write_text(json.dumps(result, indent=2))
    print(f"Selected {result['osm_element']}/{result['osm_id']}: "
          f"{result['building_tag']}, {result['levels']} floors, {result['area_m2']} m^2, "
          f"{len(interior_rings)} interior hole(s)")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
