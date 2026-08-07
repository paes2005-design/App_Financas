const states=new Map();

function monthLabel(year,month){
  return new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}).format(new Date(year,month-1,1));
}

function payload(viewId,state){
  const start=`${state.year}-${String(state.month).padStart(2,"0")}-01`;
  const lastDay=new Date(state.year,state.month,0).getDate();
  const end=`${state.year}-${String(state.month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
  return {viewId,year:state.year,month:state.month,key:`${state.year}-${String(state.month).padStart(2,"0")}`,start,end,label:monthLabel(state.year,state.month)};
}

function emit(viewId){
  const detail=payload(viewId,states.get(viewId));
  window.dispatchEvent(new CustomEvent("period-change",{detail}));
  return detail;
}

export function createMonthNavigator(viewId,container){
  if(!container)return null;
  const now=new Date();
  const state=states.get(viewId)||{year:now.getFullYear(),month:now.getMonth()+1};
  states.set(viewId,state);
  container.classList.add("month-navigator");
  container.innerHTML=`<button type="button" data-month-prev aria-label="Mês anterior">‹</button><strong data-month-label></strong><button type="button" data-month-next aria-label="Próximo mês">›</button><button type="button" data-month-current class="month-current">Mês atual</button>`;
  const label=container.querySelector("[data-month-label]");
  const paint=()=>{label.textContent=monthLabel(state.year,state.month);};
  const move=(delta)=>{const date=new Date(state.year,state.month-1+delta,1);state.year=date.getFullYear();state.month=date.getMonth()+1;paint();emit(viewId);};
  container.querySelector("[data-month-prev]").addEventListener("click",()=>move(-1));
  container.querySelector("[data-month-next]").addEventListener("click",()=>move(1));
  container.querySelector("[data-month-current]").addEventListener("click",()=>{const d=new Date();state.year=d.getFullYear();state.month=d.getMonth()+1;paint();emit(viewId);});
  paint();
  queueMicrotask(()=>emit(viewId));
  return {getPeriod:()=>payload(viewId,state)};
}

export function getPeriod(viewId){
  const now=new Date();
  if(!states.has(viewId))states.set(viewId,{year:now.getFullYear(),month:now.getMonth()+1});
  return payload(viewId,states.get(viewId));
}

if(!document.getElementById("month-navigator-styles")){
  const style=document.createElement("style");
  style.id="month-navigator-styles";
  style.textContent=`.month-navigator{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px 14px;margin-bottom:4px;border:1px solid var(--border);border-radius:14px;background:var(--surface)}.month-navigator strong{min-width:190px;text-align:center;text-transform:capitalize;font-size:1.05rem}.month-navigator button{border:1px solid var(--border);border-radius:9px;background:white;min-width:40px;height:38px;font-weight:800;color:var(--primary)}.month-navigator .month-current{padding:0 12px;font-size:.82rem}.dynamic-filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:14px}.dynamic-filter-grid>*{padding:10px;border:1px solid var(--border);border-radius:9px;background:white}@media(max-width:520px){.month-navigator{flex-wrap:wrap}.month-navigator strong{order:-1;width:100%}}`;
  document.head.appendChild(style);
}
