import { getPeriod } from "./period.js";
import { syncRecurrences } from "./recurrence-v2.js";

window.addEventListener("period-change",event=>{
  const view=event.detail?.viewId;
  if(!["dashboard","receitas","despesas","transferencias"].includes(view))return;
  try{
    const period=getPeriod(view);
    setTimeout(()=>syncRecurrences(period.start,period.end),40);
  }catch(error){console.error("Falha ao sincronizar o período recorrente:",error);}
});
