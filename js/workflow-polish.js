import { getPeriod } from "./period.js";

const configs={
  receitaForm:{date:"receitaData",view:"receitas"},
  despesaForm:{date:"despesaData",view:"despesas"},
  transferForm:{date:"transferData",view:"transferencias"}
};
function today(){return new Date().toISOString().slice(0,10);}
function defaultDate(view){try{const p=getPeriod(view),t=today();return t>=p.start&&t<=p.end?t:p.start;}catch{return today();}}
function setDate(formId){const c=configs[formId],el=c&&document.getElementById(c.date);if(el&&!el.value)el.value=defaultDate(c.view);}
function wireForms(){for(const id of Object.keys(configs)){const form=document.getElementById(id);if(!form||form.dataset.dateResetWired)continue;form.dataset.dateResetWired="1";form.addEventListener("reset",()=>setTimeout(()=>setDate(id),0));setDate(id);}}

function wireCardClose(){const message=document.getElementById("cardExpenseMessage"),modal=message?.closest(".card-expense-modal");if(!message||!modal||message.dataset.autoCloseWired)return;message.dataset.autoCloseWired="1";new MutationObserver(()=>{const success=message.classList.contains("success"),text=message.textContent||"";if(success&&/(registrada|adicionada|atualizada|salva)/i.test(text))setTimeout(()=>modal.classList.add("hidden"),250);}).observe(message,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["class"]});}
function setup(){wireForms();wireCardClose();}
setTimeout(setup,0);
new MutationObserver(()=>queueMicrotask(setup)).observe(document.body,{childList:true,subtree:true});
window.addEventListener("period-change",e=>{const view=e.detail?.viewId;for(const [id,c] of Object.entries(configs))if(c.view===view)setTimeout(()=>setDate(id),0);});
