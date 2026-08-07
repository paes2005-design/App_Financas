const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const pageTitle = document.getElementById("pageTitle");

menuButton.addEventListener("click", () => sidebar.classList.toggle("open"));

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    pageTitle.textContent = button.textContent.trim();
    sidebar.classList.remove("open");
  });
});
