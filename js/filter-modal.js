const configs={
  receitas:{title:"Filtros de receitas",grid:"#receitas .dynamic-filter-grid",datePrefix:"receita"},
  despesas:{title:"Filtros de despesas",grid:"#despesas .dynamic-filter-grid",datePrefix:"despesa"},
  transferencias:{title:"Filtros de transferências",grid:"#transferencias .dynamic-filter-grid",datePrefix:"transfer"}
};

const style=document.createElement("style");
style.textContent=`
.filter-launch{margin-left:auto;width:42px;height:40px;border:1px solid var(--border);border-radius:9px;background:white;color:var(--primary);display:grid;place-items:center}.filter-launch svg{width:21px;height:21px}.filter-modal{position:fixed;inset:0;z-index:1800;display:grid;place-items:center;padding:16px}.filter-modal.hidden{display:none!important}.filter-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.5)}.filter-card{position:relative;width:min(520px,100%);max-height:90vh;overflow:auto;padding:18px;background:white;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.25)}.filter-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.filter-head h3{margin:0}.filter-close{border:0;background:#eef3fa;border-radius:9px;width:38px;height:38px;font-size:1.25rem}.filter-period{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.filter-period select,.filter-period input{width:100%;padding:10px;border:1px solid var(--border);border-radius:9px;background:white}.filter-modal .dynamic-filter-grid{display:grid!important;grid-template-columns:1fr 1fr;margin:0}.filter-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.filter-actions button{padding:10px 14px;border-radius:9px;border:1px solid var(--border);background:white}.filter-actions .apply-filter{background:var(--primary);color:white;border-color:var(--primary)}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}@media(max-width:520px){.filter-modal .dynamic-filter-grid,.filter-period{grid-template-columns:1fr}}
`;
document.head.appendChild(style);

function icon(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7v5l-4 2v-7L4 5z"/></svg>`;}

function setup(viewId,cfg){
  const view=document.getElementById(viewId),grid=document.querySelector(cfg.grid);if(!view||!grid||grid.dataset.modalized)return;
  grid.dataset.modalized="1";
  const panel=grid.closest(".panel"),heading=panel?.querySelector(".panel-heading")||panel?.querySelector("h3")?.parentElement;
  const launch=document.createElement("button");launch.type="button";launch.className="filter-launch";launch.innerHTML=icon();launch.title="Filtros";launch.setAttribute("aria-label","Abrir filtros");
  if(heading?.classList.contains("panel-heading"))heading.appendChild(launch);else panel?.prepend(launch);
  const modal=document.createElement("div");modal.className="filter-modal hidden";modal.innerHTML=`<div class="filter-backdrop"></div><section class="filter-card" role="dialog" aria-modal="true"><div class="filter-head"><h3>${cfg.title}</h3><button class="filter-close" type="button" aria-label="Fechar">×</button></div><div class="filter-period"><select data-period><option value="month">Mês selecionado</option><option value="quarter">Trimestre</option><option value="semester">Semestre</option><option value="year">Ano</option><option value="custom">Período personalizado</option></select><span></span><input data-date-start type="date" aria-label="Data inicial"><input data-date-end type="date" aria-label="Data final"></div><div data-filter-host></div><div class="filter-actions"><button type="button" data-clear>Limpar</button><button type="button" class="apply-filter" data-apply>Aplicar filtros</button></div></section>`;
  document.body.appendChild(modal);modal.querySelector("[data-filter-host]").appendChild(grid);
  const period=modal.querySelector("[data-period]"),start=modal.querySelector("[data-date-start]"),end=modal.querySelector("[data-date-end]");
  const emit=()=>window.dispatchEvent(new CustomEvent("transaction-filter-change",{detail:{viewId,period:period.value,start:start.value,end:end.value}}));
  const open=()=>{modal.classList.remove("hidden");history.pushState({appOverlay:`filters-${viewId}`},"");};
  const close=(back=true)=>{if(modal.classList.contains("hidden"))return;modal.classList.add("hidden");if(back)history.back();};
  launch.addEventListener("click",open);modal.querySelector(".filter-backdrop").addEventListener("click",()=>close());modal.querySelector(".filter-close").addEventListener("click",()=>close());modal.querySelector("[data-apply]").addEventListener("click",()=>{emit();close();});
  modal.querySelector("[data-clear]").addEventListener("click",()=>{grid.querySelectorAll("select").forEach(s=>s.selectedIndex=0);period.value="month";start.value="";end.value="";grid.querySelectorAll("select").forEach(s=>s.dispatchEvent(new Event("change",{bubbles:true})));emit();});
  period.addEventListener("change",()=>{if(period.value!=="custom"){start.value="";end.value="";}});
  window.addEventListener("popstate",()=>{if(!modal.classList.contains("hidden"))modal.classList.add("hidden");});
}

function scan(){Object.entries(configs).forEach(([id,cfg])=>setup(id,cfg));}
scan();setTimeout(scan,0);window.addEventListener("load",scan);
