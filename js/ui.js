const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const pageTitle = document.getElementById("pageTitle");
const placeholder = document.getElementById("placeholderView");
const placeholderTitle = document.getElementById("placeholderTitle");

let menuHistoryActive=false;

if(!document.getElementById("mobile-menu-layer-fix")){
  const style=document.createElement("style");
  style.id="mobile-menu-layer-fix";
  style.textContent=`
    @media(max-width:760px){
      .sidebar{z-index:2147483646!important;isolation:isolate}
      .sidebar.open + .main-content .dashboard-actions,
      body.mobile-menu-open .dashboard-actions,
      body.mobile-menu-open .dashboard-settings-panel{
        display:none!important;
        visibility:hidden!important;
        opacity:0!important;
        pointer-events:none!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function syncMenuState(open){
  document.body.classList.toggle("mobile-menu-open",open);
}

function openMenu(){
  if(sidebar.classList.contains("open"))return;
  sidebar.classList.add("open");
  syncMenuState(true);
  if(!menuHistoryActive){
    history.pushState({appOverlay:"sidebar"},"");
    menuHistoryActive=true;
  }
}

function closeMenu({fromHistory=false}={}){
  if(!sidebar.classList.contains("open")){
    syncMenuState(false);
    return;
  }
  sidebar.classList.remove("open");
  syncMenuState(false);
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
