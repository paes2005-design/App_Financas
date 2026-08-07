const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const pageTitle = document.getElementById("pageTitle");
const placeholder = document.getElementById("placeholderView");
const placeholderTitle = document.getElementById("placeholderTitle");

let menuHistoryActive=false;

// Correção específica para o celular: enquanto o menu lateral estiver aberto,
// os controles flutuantes da Dashboard não podem aparecer por cima dele.
if(!document.getElementById("mobile-menu-layer-fix")){
  const style=document.createElement("style");
  style.id="mobile-menu-layer-fix";
  style.textContent=`
    @media(max-width:760px){
      body.mobile-menu-open .dashboard-actions,
      body.mobile-menu-open .dashboard-settings-panel{
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
      body.mobile-menu-open .sidebar{
        z-index:1000!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function openMenu(){
  if(sidebar.classList.contains("open"))return;
  sidebar.classList.add("open");
  document.body.classList.add("mobile-menu-open");
  if(!menuHistoryActive){
    history.pushState({appOverlay:"sidebar"},"");
    menuHistoryActive=true;
  }
}

function closeMenu({fromHistory=false}={}){
  if(!sidebar.classList.contains("open")){
    document.body.classList.remove("mobile-menu-open");
    return;
  }
  sidebar.classList.remove("open");
  document.body.classList.remove("mobile-menu-open");
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
