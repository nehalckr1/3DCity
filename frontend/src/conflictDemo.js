import * as Cesium from "cesium";

import { recordConflictDetected } from "./dashboard.js";

// Fixed demo target so the pitch narration ("Unit F03-U02 overlaps with a
// newly submitted claim") is reproducible on every click.
const TARGET_ULPIN = "KA-BLR-00042-F03-U02";
const CLAIM_ENTITY_ID = "conflict-claim-demo";

const button = document.getElementById("conflictBtn");
const messageEl = document.getElementById("conflictMessage");

function ringBBox(ring) {
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return {
    lonMin: Math.min(...lons),
    lonMax: Math.max(...lons),
    latMin: Math.min(...lats),
    latMax: Math.max(...lats),
  };
}

function bboxOverlap(a, b) {
  return a.lonMin < b.lonMax && a.lonMax > b.lonMin && a.latMin < b.latMax && a.latMax > b.latMin;
}

function shiftRingEast(ring, lonShift) {
  return ring.map(([lon, lat]) => [lon + lonShift, lat]);
}

export function initConflictDemo(viewer, { entitiesByUlpin, featuresByUlpin }) {
  let flaggedEntities = [];

  function reset() {
    viewer.entities.removeById(CLAIM_ENTITY_ID);
    for (const entity of flaggedEntities) {
      entity.polygon.material = entity.baseMaterial;
      entity.polygon.outlineColor = Cesium.Color.BLACK;
      entity.polygon.outlineWidth = 1;
    }
    flaggedEntities = [];
    messageEl.classList.add("hidden");
  }

  button.addEventListener("click", () => {
    reset();

    const targetFeature = featuresByUlpin.get(TARGET_ULPIN);
    if (!targetFeature) {
      messageEl.textContent = `Demo target ${TARGET_ULPIN} not found in loaded data.`;
      messageEl.classList.remove("hidden");
      return;
    }

    // Offset the target's own footprint east by half its width so the
    // injected claim visibly overlaps only the target unit, not its neighbors.
    const targetRing = targetFeature.geometry.coordinates[0];
    const targetBBox = ringBBox(targetRing);
    const lonShift = (targetBBox.lonMax - targetBBox.lonMin) * 0.5;
    const claimRing = shiftRingEast(targetRing, lonShift);
    const claimBBox = ringBBox(claimRing);

    viewer.entities.add({
      id: CLAIM_ENTITY_ID,
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(claimRing.flatMap(([lon, lat]) => [lon, lat])),
        height: targetFeature.properties.z_min,
        extrudedHeight: targetFeature.properties.z_max,
        material: Cesium.Color.WHITE.withAlpha(0.35),
        outline: true,
        outlineColor: Cesium.Color.ORANGE,
        outlineWidth: 2,
      },
    });

    // Reuse the same containment/overlap logic style as topology_validator.py
    // (axis-aligned rectangle bbox test), ported client-side for the live demo.
    const conflicts = [];
    for (const feature of featuresByUlpin.values()) {
      if (feature.properties.floor !== targetFeature.properties.floor) continue;
      const bbox = ringBBox(feature.geometry.coordinates[0]);
      if (bboxOverlap(claimBBox, bbox)) {
        conflicts.push(feature.properties);
      }
    }

    for (const props of conflicts) {
      const entity = entitiesByUlpin.get(props.id_3d_ulpin);
      entity.polygon.material = Cesium.Color.RED.withAlpha(0.9);
      entity.polygon.outlineColor = Cesium.Color.RED;
      entity.polygon.outlineWidth = 3;
      flaggedEntities.push(entity);
    }

    if (conflicts.length > 0) recordConflictDetected();

    const labels = conflicts
      .map((p) => p.id_3d_ulpin.replace(`${p.base_ulpin}-`, ""))
      .join(", ");

    messageEl.textContent = conflicts.length
      ? `Ownership conflict detected: Unit ${labels} overlaps with a newly submitted claim.`
      : "No overlap detected against the simulated claim.";
    messageEl.classList.remove("hidden");
  });
}
