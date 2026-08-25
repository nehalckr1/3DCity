import { openCertificate } from "./certificate.js";

const panel = document.getElementById("infoPanel");
const closeBtn = document.getElementById("infoPanelClose");
const certBtn = document.getElementById("certBtn");
const statusBadge = document.getElementById("infoStatusBadge");

let currentProperties = null;

closeBtn.addEventListener("click", hideUnitInfo);
certBtn.addEventListener("click", () => {
  if (currentProperties) openCertificate(currentProperties);
});

const STATUS_CLASSES = {
  Registered: "status-registered",
  "Pending Verification": "status-pending",
  "Disputed / Encumbered": "status-disputed",
  "Vacant / Available": "status-vacant",
};

export function showUnitInfo(properties) {
  currentProperties = properties;
  document.getElementById("infoUlpin").textContent = properties.id_3d_ulpin;

  statusBadge.textContent = properties.status ?? "Unknown";
  statusBadge.className = `status-badge ${STATUS_CLASSES[properties.status] ?? ""}`;

  document.getElementById("infoFloor").textContent = `Floor ${properties.floor}`;
  document.getElementById("infoUnit").textContent = `Unit ${properties.unit_letter}`;
  document.getElementById("infoOwner").textContent = properties.owner_name;
  document.getElementById("infoPurchaseDate").textContent = properties.purchase_date ?? "—";
  document.getElementById("infoGeometrySource").textContent =
    properties.geometry_source === "real" ? "📍 Real (OpenStreetMap)" : "🔧 Estimated";
  document.getElementById("infoSource").textContent =
    properties.source === "real" ? "📍 Real" : "🔧 Mock (fictional)";
  panel.classList.remove("hidden");
}

export function hideUnitInfo() {
  panel.classList.add("hidden");
}
