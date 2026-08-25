const modal = document.getElementById("dashboardModal");
const openBtn = document.getElementById("dashboardBtn");
const closeBtn = document.getElementById("dashboardModalClose");
const conflictsEl = document.getElementById("statConflictsDetected");

let conflictsDetectedThisSession = 0;

function renderStats(featuresByUlpin) {
  const units = [...featuresByUlpin.values()].map((f) => f.properties);
  const floors = new Set(units.map((u) => u.floor)).size;
  const owners = new Set(units.map((u) => u.owner_name)).size;

  document.getElementById("statTotalUnits").textContent = units.length;
  document.getElementById("statTotalFloors").textContent = floors;
  document.getElementById("statUnitsPerFloor").textContent = Math.round(units.length / floors);
  document.getElementById("statUniqueOwners").textContent = owners;
}

export function initDashboard(featuresByUlpin) {
  renderStats(featuresByUlpin);

  openBtn.addEventListener("click", () => {
    renderStats(featuresByUlpin);
    modal.classList.remove("hidden");
  });
  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
}

// Called by conflictDemo.js each time "Simulate competing claim" surfaces a
// real overlap, so the dashboard's headline stat reflects the live demo.
export function recordConflictDetected() {
  conflictsDetectedThisSession += 1;
  conflictsEl.textContent = conflictsDetectedThisSession;
}
