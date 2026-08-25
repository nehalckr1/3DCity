const modal = document.getElementById("guideModal");
const openBtn = document.getElementById("guideBtn");
const closeBtn = document.getElementById("guideModalClose");

export function initUlpinGuide() {
  openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
}
