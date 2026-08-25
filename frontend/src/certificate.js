import QRCode from "qrcode";

const modal = document.getElementById("certificateModal");
const closeBtn = document.getElementById("certificateModalClose");
const printBtn = document.getElementById("certPrintBtn");

export function openCertificate(properties) {
  document.getElementById("certUlpin").textContent = properties.id_3d_ulpin;
  document.getElementById("certFloorUnit").textContent =
    `Floor ${properties.floor} · Unit ${properties.unit_letter}`;
  document.getElementById("certOwner").textContent = properties.owner_name;
  document.getElementById("certPurchaseDate").textContent = properties.purchase_date ?? "—";
  document.getElementById("certStatus").textContent = properties.status ?? "Unknown";
  document.getElementById("certGeometrySource").textContent =
    properties.geometry_source === "real" ? "Real (OpenStreetMap)" : "Estimated";

  const payload = JSON.stringify({
    ulpin: properties.id_3d_ulpin,
    owner: properties.owner_name,
    base_ulpin: properties.base_ulpin,
  });
  const canvas = document.getElementById("certQrCanvas");
  QRCode.toCanvas(canvas, payload, { width: 120, margin: 1 }, (err) => {
    if (err) console.error(err);
  });

  modal.classList.remove("hidden");
}

export function initCertificate() {
  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  printBtn.addEventListener("click", () => window.print());
}
