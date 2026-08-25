"""Overlap/containment checks for generated unit geometries.

Uses shapely for this round's static generation step. PostGIS isn't wired
live for this round, but these checks mirror ST_Contains / ST_Overlaps so
the same validation logic carries over once db.py is wired up for real.
"""

from collections import defaultdict

from shapely.geometry import shape
from shapely.ops import unary_union

OVERLAP_TOLERANCE_DEG2 = 1e-14


def validate_building(feature_collection: dict) -> tuple[bool, list[str]]:
    errors: list[str] = []

    by_floor = defaultdict(list)
    for feature in feature_collection["features"]:
        floor = feature["properties"]["floor"]
        by_floor[floor].append(feature)

    for floor, features in sorted(by_floor.items()):
        polygons = [shape(f["geometry"]) for f in features]
        floor_footprint = unary_union(polygons).buffer(1e-9)

        for feature, polygon in zip(features, polygons):
            ulpin = feature["properties"]["id_3d_ulpin"]
            if not floor_footprint.contains(polygon.buffer(-1e-9)):
                errors.append(f"{ulpin}: not contained within floor {floor} footprint")

        for i in range(len(polygons)):
            for j in range(i + 1, len(polygons)):
                overlap_area = polygons[i].intersection(polygons[j]).area
                if overlap_area > OVERLAP_TOLERANCE_DEG2:
                    a = features[i]["properties"]["id_3d_ulpin"]
                    b = features[j]["properties"]["id_3d_ulpin"]
                    errors.append(
                        f"{a} overlaps {b} on floor {floor} (area={overlap_area:.2e})"
                    )

    return (len(errors) == 0, errors)
