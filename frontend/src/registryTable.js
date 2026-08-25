const modal = document.getElementById("registryModal");
const openBtn = document.getElementById("registryBtn");
const closeBtn = document.getElementById("registryModalClose");
const filterInput = document.getElementById("registryFilterInput");
const tbody = document.getElementById("registryTableBody");
const exportBtn = document.getElementById("registryExportBtn");

let allUnits = [];

function renderRows(filterText = "") {
  const query = filterText.trim().toLowerCase();
  tbody.innerHTML = "";

  const rows = allUnits.filter(
    (u) =>
      !query ||
      u.id_3d_ulpin.toLowerCase().includes(query) ||
      u.owner_name.toLowerCase().includes(query)
  );

  for (const u of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id_3d_ulpin}</td>
      <td>${u.floor}</td>
      <td>${u.unit_letter}</td>
      <td>${u.owner_name}</td>
      <td>${u.purchase_date ?? "—"}</td>
      <td>${u.status ?? "—"}</td>
      <td>${u.source}</td>
    `;
    tbody.appendChild(tr);
  }
}

function exportCsv() {
  const headers = ["ULPIN", "Floor", "Unit", "Owner", "Purchase Date", "Status", "Source"];
  const rows = allUnits.map((u) => [
    u.id_3d_ulpin,
    u.floor,
    u.unit_letter,
    u.owner_name,
    u.purchase_date ?? "",
    u.status ?? "",
    u.source,
  ]);
  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "verticadastre-registry.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function initRegistryTable(featuresByUlpin) {
  allUnits = [...featuresByUlpin.values()]
    .map((f) => f.properties)
    .sort((a, b) => a.id_3d_ulpin.localeCompare(b.id_3d_ulpin));
  renderRows();

  openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  filterInput.addEventListener("input", (e) => renderRows(e.target.value));
  exportBtn.addEventListener("click", exportCsv);
}
