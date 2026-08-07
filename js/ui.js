const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const pageTitle = document.getElementById("pageTitle");
const placeholder = document.getElementById("placeholderView");
const placeholderTitle = document.getElementById("placeholderTitle");

let menuHistoryActive=false;

function openMenu(){
  if(sidebar.classList.contains("open"))return;
  sidebar.classList.add("open");
  if(!menuHistoryActive){
    history.pushState({appOverlay:"sidebar"},"");
    menuHistoryActive=true;
  }
}

function closeMenu({fromHistory=false}={}){
  if(!sidebar.classList.contains("open"))return;
  sidebar.classList.remove("open");
  if(fromHistory){menuHistoryActive=false;return;}
  if(menuHistoryActive)history.back();
}

menuButton.addEventListener("click",()=>{
  if(sidebar.classList.contains("open"))closeMenu();
  else openMenu();
});

window.addEventListener("popstate",()=>{
  if(sidebar.classList.contains("open"))closeMenu({fromHistory:true});
});

function abrirPagina(page, titulo) {
  document.querySelectorAll(".app-view").forEach((view) => view.classList.add("hidden"));
  const target = document.getElementById(page);
  if (target) target.classList.remove("hidden");
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
    closeMenu();
  });
});
