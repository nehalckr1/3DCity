import * as Cesium from "cesium";

import { showUnitInfo } from "./unitInfoPanel.js";

const input = document.getElementById("searchInput");
const button = document.getElementById("searchBtn");
const status = document.getElementById("searchStatus");

let highlightedEntity = null;

function clearHighlight() {
  if (highlightedEntity) {
    highlightedEntity.polygon.material = highlightedEntity.baseMaterial;
    highlightedEntity = null;
  }
}

export function initSearch(viewer, entitiesByUlpin) {
  function runSearch() {
    const query = input.value.trim().toUpperCase();
    status.classList.remove("error", "success");

    if (!query) {
      status.textContent = "";
      return;
    }

    const entity = entitiesByUlpin.get(query);
    if (!entity) {
      status.textContent = `No unit found for "${query}"`;
      status.classList.add("error");
      return;
    }

    clearHighlight();
    entity.polygon.material = Cesium.Color.YELLOW.withAlpha(0.9);
    highlightedEntity = entity;

    viewer.flyTo(entity, {
      duration: 1.2,
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(25),
        Cesium.Math.toRadians(-25),
        90
      ),
    });

    showUnitInfo(entity.unitProperties);
    status.textContent = `Found ${query}`;
    status.classList.add("success");
  }

  button.addEventListener("click", runSearch);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearch();
  });
}
