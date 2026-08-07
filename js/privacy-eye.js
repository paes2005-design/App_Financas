const dashboard = document.getElementById("dashboard");
const button = document.getElementById("dashboardValueToggle");

if (dashboard && button) {
  const eyeIcon = `
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>`;

  const eyeOffIcon = `
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3l18 18"></path>
      <path d="M10.6 5.2A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-2.1 3.1"></path>
      <path d="M6.1 6.1C3.8 8 2.5 12 2.5 12s3.5 7 9.5 7a9.8 9.8 0 0 0 4.2-.9"></path>
      <path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"></path>
    </svg>`;

  button.classList.add("dashboard-eye-button");

  function paint() {
    const hidden = dashboard.classList.contains("dashboard-values-hidden");
    button.innerHTML = hidden ? eyeOffIcon : eyeIcon;
    button.setAttribute("aria-label", hidden ? "Mostrar valores" : "Ocultar valores");
    button.title = hidden ? "Mostrar valores" : "Ocultar valores";
  }

  paint();

  const observer = new MutationObserver(paint);
  observer.observe(dashboard, { attributes: true, attributeFilter: ["class"] });

  const style = document.createElement("style");
  style.textContent = `
    .dashboard-eye-button{
      width:44px;
      height:40px;
      padding:0!important;
      display:inline-grid;
      place-items:center;
      color:var(--primary);
    }
    .dashboard-eye-button svg{pointer-events:none}
  `;
  document.head.appendChild(style);
}
