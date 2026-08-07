import { auth, db } from "./firebase.js";
import { collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { nextDate } from "./recurrence-v3.js";
import { invoiceMeta } from "./card-finance-rules-v2.js";

let user=null,syncing=false;
const pad=n=>String(n).padStart(2,"0");
function parts(data){const d=new Date(`${data}T12:00:00`),m=d.getMonth()+1;return{ano:d.getFullYear(),mes:m,trimestre:Math.ceil(m/3),semestre:m<=6?1:2,dataChave:data};}
function monthBounds(){const d=new Date(),y=d.getFullYear(),m=d.getMonth();return{start:`${y}-${pad(m+1)}-01`,end:`${y}-${pad(m+1)}-${pad(new Date(y,m+1,0).getDate())}`};}
function datesFor(series,start,end){const out=[];for(let i=0;i<20000;i++){const d=nextDate(series.inicio,series.frequencia||"mensal",i);if(d>end)break;if(d>=start)out.push(d);}return out;}
async function syncCardFixed(start=null,end=null){if(!user||syncing)return;syncing=true;try{const b=monthBounds();start=start||b.start;end=end||b.end;const [seriesSnap,expenseSnap]=await Promise.all([getDocs(collection(db,"users",user.uid,"recorrencias")),getDocs(collection(db,"users",user.uid,"despesas"))]),existing=expenseSnap.docs.map(d=>d.data());for(const sd of seriesSnap.docs){const s={id:sd.id,...sd.data()};if(!s.ativo||s.operacao!=="cartaoDespesa"||s.tipoRecorrencia!=="fixa")continue;const exceptions=new Set(s.excecoes||[]);for(const date of datesFor(s,start,end)){if(exceptions.has(date)||existing.some(r=>r.serieId===s.id&&r.data===date))continue;const base=s.base||{},closing=Number(base.cartaoFechamento||31),due=Number(base.cartaoVencimento||closing),inv=invoiceMeta(date,closing,due);await addDoc(collection(db,"users",user.uid,"despesas"),{...base,valor:Number(Number(s.valorParcela||0).toFixed(2)),data:date,dataCompra:date,...parts(date),...inv,competencia:date.slice(0,7),serieId:s.id,recorrenciaTipo:"fixa",frequencia:s.frequencia||"mensal",planejada:true,efetivada:false,criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});existing.push({serieId:s.id,data:date});}}}catch(e){console.error("Falha ao sincronizar despesas fixas do cartão:",e);}finally{syncing=false;}}
onAuthStateChanged(auth,current=>{user=current;if(current)setTimeout(()=>syncCardFixed(),150);});
window.addEventListener("period-change",e=>{const d=e.detail||{};if(!user||!["dashboard","despesas","cartoes"].includes(d.viewId))return;setTimeout(()=>syncCardFixed(d.start||null,d.end||null),80);});
export { syncCardFixed };
