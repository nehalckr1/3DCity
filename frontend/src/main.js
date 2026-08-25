import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { showUnitInfo, hideUnitInfo } from "./unitInfoPanel.js";
import { initSearch } from "./search.js";
import { initConflictDemo } from "./conflictDemo.js";
import { initRegistryTable } from "./registryTable.js";
import { initDashboard } from "./dashboard.js";
import { initCertificate } from "./certificate.js";
import { initUlpinGuide } from "./ulpinGuide.js";

const STATUS_COLORS = {
  Registered: Cesium.Color.fromCssColorString("#22c55e"),
  "Pending Verification": Cesium.Color.fromCssColorString("#f59e0b"),
  "Disputed / Encumbered": Cesium.Color.fromCssColorString("#ef4444"),
  "Vacant / Available": Cesium.Color.fromCssColorString("#94a3b8"),
};

function statusColor(status) {
  return STATUS_COLORS[status] ?? Cesium.Color.fromCssColorString("#94a3b8");
}

const DEFAULT_OUTLINE_ALPHA = 0.45;
const HOVER_OUTLINE_ALPHA = 1.0;

const viewer = new Cesium.Viewer("cesiumContainer", {
  // Real OSM basemap: the building's footprint and position are now genuinely
  // real data (see fetch_real_building.py), so the real street imagery around
  // it reinforces that instead of misrepresenting a place (unlike the earlier
  // fully-fictional building, which is why this was off before).
  baseLayer: new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({})),
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  animation: false,
  timeline: false,
  fullscreenButton: false,
  infoBox: false,
  selectionIndicator: false,
});
viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#16261c");

function computeBuildingCentroid(featureCollection) {
  let sumLon = 0;
  let sumLat = 0;
  let count = 0;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const feature of featureCollection.features) {
    for (const [lon, lat] of feature.geometry.coordinates[0]) {
      sumLon += lon;
      sumLat += lat;
      count++;
    }
    minZ = Math.min(minZ, feature.properties.z_min);
    maxZ = Math.max(maxZ, feature.properties.z_max);
  }

  return { lon: sumLon / count, lat: sumLat / count, height: (minZ + maxZ) / 2 };
}

function computeBuildingBounds(featureCollection) {
  let lonMin = Infinity;
  let lonMax = -Infinity;
  let latMin = Infinity;
  let latMax = -Infinity;

  for (const feature of featureCollection.features) {
    for (const [lon, lat] of feature.geometry.coordinates[0]) {
      lonMin = Math.min(lonMin, lon);
      lonMax = Math.max(lonMax, lon);
      latMin = Math.min(latMin, lat);
      latMax = Math.max(latMax, lat);
    }
  }

  return { lonMin, lonMax, latMin, latMax };
}

function computeCameraRange(bounds, maxHeight) {
  const midLat = (bounds.latMin + bounds.latMax) / 2;
  const widthM = (bounds.lonMax - bounds.lonMin) * 111320 * Math.cos((midLat * Math.PI) / 180);
  const depthM = (bounds.latMax - bounds.latMin) * 110540;
  const diagonal = Math.sqrt(widthM ** 2 + depthM ** 2 + maxHeight ** 2);
  return diagonal * 1.3;
}

function showBuildingBadge(building) {
  const el = document.getElementById("buildingBadge");
  el.textContent =
    `📍 Real footprint & floor count (OpenStreetMap ${building.osm_element} ${building.osm_id}) · ` +
    `${building.levels} floors · unit layout & owner records are mock`;
  el.classList.remove("hidden");
}

function ringToPositions(ring) {
  const flat = ring.flatMap(([lon, lat]) => [lon, lat]);
  return Cesium.Cartesian3.fromDegreesArray(flat);
}

// GeoJSON Polygon coordinates are [exterior, hole1, hole2, ...]. Most units
// are a plain exterior ring, but a unit whose real footprint has an enclosed
// courtyard/void needs the hole rendered as an actual hole, not filled in
// solid — that's what caused the "doesn't sit on the real footprint" bug in
// the first place (see CLAUDE.md debug notes), so keep both cases correct.
function coordinatesToHierarchy(coordinates) {
  const [exterior, ...holes] = coordinates;
  if (holes.length === 0) {
    return ringToPositions(exterior);
  }
  return new Cesium.PolygonHierarchy(
    ringToPositions(exterior),
    holes.map((hole) => new Cesium.PolygonHierarchy(ringToPositions(hole)))
  );
}

function addUnitEntity(feature) {
  const props = feature.properties;
  const color = statusColor(props.status).withAlpha(0.88);
  const outlineColor = Cesium.Color.BLACK.withAlpha(DEFAULT_OUTLINE_ALPHA);

  const entity = viewer.entities.add({
    id: props.id_3d_ulpin,
    polygon: {
      hierarchy: coordinatesToHierarchy(feature.geometry.coordinates),
      height: props.z_min,
      extrudedHeight: props.z_max,
      material: color,
      outline: true,
      outlineColor,
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.NONE,
    },
  });
  entity.unitProperties = props;
  entity.baseMaterial = color;
  entity.baseOutlineColor = outlineColor;
  return entity;
}

async function main() {
  const response = await fetch("/data/buildingData.geojson");
  const featureCollection = await response.json();

  const entitiesByUlpin = new Map();
  const featuresByUlpin = new Map();

  for (const feature of featureCollection.features) {
    const entity = addUnitEntity(feature);
    entitiesByUlpin.set(feature.properties.id_3d_ulpin, entity);
    featuresByUlpin.set(feature.properties.id_3d_ulpin, feature);
  }

  const bounds = computeBuildingBounds(featureCollection);

  // The real OSM building outline, drawn flat on the ground as a reference —
  // shows the true footprint our unit grid was fitted inside.
  const building = featureCollection.building;
  if (building?.real_footprint_lonlat) {
    viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(building.real_footprint_lonlat.flat()),
        width: 2,
        material: Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.8),
        clampToGround: false,
      },
    });
  }

  // Anchor the camera's orbit to the building's centroid instead of the
  // default globe-navigation behavior (which pans across the basemap on
  // drag rather than rotating around the building). lookAtTransform gives
  // an explicit offset, so — unlike trackedEntity — it doesn't re-derive a
  // default view distance from a (sizeless) point entity.
  const centroid = computeBuildingCentroid(featureCollection);
  const centroidCartesian = Cesium.Cartesian3.fromDegrees(centroid.lon, centroid.lat, centroid.height);
  const centroidTransform = Cesium.Transforms.eastNorthUpToFixedFrame(centroidCartesian);
  const maxHeight = Math.max(...featureCollection.features.map((f) => f.properties.z_max));
  const cameraRange = computeCameraRange(bounds, maxHeight);
  viewer.camera.lookAtTransform(
    centroidTransform,
    new Cesium.HeadingPitchRange(Cesium.Math.toRadians(35), Cesium.Math.toRadians(-25), cameraRange)
  );

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);
    if (Cesium.defined(picked) && picked.id && picked.id.unitProperties) {
      showUnitInfo(picked.id.unitProperties);
    } else {
      hideUnitInfo();
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // Keep per-unit boundaries subtle by default (Task 3: reduce visual noise);
  // emphasize the unit under the cursor on hover instead.
  let hoveredEntity = null;
  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.endPosition);
    const entity = Cesium.defined(picked) && picked.id && picked.id.unitProperties ? picked.id : null;

    if (hoveredEntity === entity) return;
    if (hoveredEntity) {
      hoveredEntity.polygon.outlineColor = hoveredEntity.baseOutlineColor;
    }
    if (entity) {
      entity.polygon.outlineColor = Cesium.Color.WHITE.withAlpha(HOVER_OUTLINE_ALPHA);
    }
    hoveredEntity = entity;
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  if (building) {
    showBuildingBadge(building);
  }

  initSearch(viewer, entitiesByUlpin);
  initConflictDemo(viewer, { entitiesByUlpin, featuresByUlpin });
  initRegistryTable(featuresByUlpin);
  initDashboard(featuresByUlpin);
  initCertificate();
  initUlpinGuide();
}

main();
