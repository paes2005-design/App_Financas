const DATE_RE=/\b(\d{4})-(\d{2})-(\d{2})\b/g;
function formatText(text){return String(text||"").replace(DATE_RE,(_,y,m,d)=>`${d}/${m}/${y}`);}
function formatRoot(root){if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes){const parent=n.parentElement;if(!parent||parent.closest("input,textarea,select,option,script,style"))continue;const next=formatText(n.nodeValue);if(next!==n.nodeValue)n.nodeValue=next;}}
const selectors=["#listaReceitas","#listaDespesas","#listaTransferencias","#listaMovimentacoes","#cardExpenseList","#dashboard-receitas","#dashboard-despesas","#dashboard-transferencias","#dashboard-cartoes"];
function run(){selectors.forEach(s=>formatRoot(document.querySelector(s)));}
setTimeout(run,0);
const observer=new MutationObserver(muts=>{let needed=false;for(const m of muts){if([...m.addedNodes].some(n=>n.nodeType===1||n.nodeType===3)){needed=true;break;}}if(needed)queueMicrotask(run);});
observer.observe(document.body,{childList:true,subtree:true});
export function formatDateBR(date){const m=String(date||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(date||"");}
