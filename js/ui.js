const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const pageTitle = document.getElementById("pageTitle");
const dashboard = document.getElementById("dashboard");
const contas = document.getElementById("contas");
const receitas = document.getElementById("receitas");
const placeholder = document.getElementById("placeholderView");
const placeholderTitle = document.getElementById("placeholderTitle");

menuButton.addEventListener("click", () => sidebar.classList.toggle("open"));

function abrirPagina(page, titulo) {
  [dashboard, contas, receitas, placeholder].filter(Boolean).forEach((view) => view.classList.add("hidden"));

  if (page === "dashboard") dashboard.classList.remove("hidden");
  else if (page === "contas") contas.classList.remove("hidden");
  else if (page === "receitas" && receitas) receitas.classList.remove("hidden");
  else {
    placeholderTitle.textContent = titulo;
    placeholder.classList.remove("hidden");
  }
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const titulo = button.textContent.trim();
    pageTitle.textContent = titulo;
    abrirPagina(button.dataset.page, titulo);
    sidebar.classList.remove("open");
  });
});
