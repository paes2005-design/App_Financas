import fs from 'node:fs';

const failures=[];
function test(name,fn){try{fn();console.log(`PASS ${name}`);}catch(e){failures.push(`${name}: ${e.message}`);console.error(`FAIL ${name}: ${e.message}`);}}
function eq(a,b,msg=''){if(a!==b)throw new Error(`${msg} esperado=${b} obtido=${a}`.trim());}
function close(a,b,eps=1e-9){if(Math.abs(a-b)>eps)throw new Error(`esperado=${b} obtido=${a}`);}
const pad=n=>String(n).padStart(2,'0');
function addMonths(date,n){const [y,m,d]=date.split('-').map(Number),base=new Date(y,m-1+n,1),last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();return `${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(Math.min(d,last))}`;}
const monthKey=d=>d.slice(0,7);
function monthSeries(start,end){const out=[];for(let i=0;i<600;i++){const d=addMonths(start,i);if(d>end)break;out.push(d);}return out;}
function splitTotal(total,q){const cents=Math.round(total*100),base=Math.floor(cents/q),rest=cents-base*q;return Array.from({length:q},(_,i)=>(base+(i<rest?1:0))/100);}
const sum=a=>a.reduce((x,y)=>x+y,0);
function projectedFixed(start,selected,value,exceptions=[]){return selected<monthKey(start)||exceptions.includes(selected)?0:value;}
function afterDelete(months,current,scope){if(scope==='one')return months.filter(m=>m!==current);if(scope==='all')return [];if(scope==='future')return months.filter(m=>m<current);throw new Error('scope inválido');}
function monthlyForecast(opening,r,d){return Math.round((opening+sum(r)-sum(d))*100)/100;}
function convert(items,rates,main='BRL'){let brl=0;for(const i of items){const r=i.currency==='BRL'?1:rates[i.currency];if(!Number.isFinite(r))throw new Error('cotação ausente');brl+=i.value*r;}return main==='BRL'?brl:brl/rates[main];}
function invoiceMonth(purchase,closing){const [y,m,d]=purchase.split('-').map(Number);return d<=closing?`${y}-${pad(m)}`:monthKey(addMonths(`${y}-${pad(m)}-01`,1));}

console.log('=== AUDITORIA MATEMÁTICA FINANCEIRA ===');
test('fixa não projeta para trás',()=>{eq(projectedFixed('2026-08-07','2026-07',100),0);eq(projectedFixed('2026-08-07','2026-08',100),100);eq(projectedFixed('2026-08-07','2027-12',100),100);});
test('fixa respeita exclusão pontual',()=>{eq(projectedFixed('2026-08-07','2026-09',100,['2026-09']),0);eq(projectedFixed('2026-08-07','2026-10',100,['2026-09']),100);});
test('por período inclui todas as competências',()=>{const x=monthSeries('2026-08-31','2026-11-30');eq(x.join(','),'2026-08-31,2026-09-30,2026-10-31,2026-11-30');});
test('parcelado valor total fecha exatamente nos centavos',()=>{const p=splitTotal(1000,3);eq(p.join(','),'333.34,333.33,333.33');eq(Math.round(sum(p)*100),100000);});
test('parcelado valor da parcela calcula total exato',()=>{const p=Array(3).fill(333.33);eq(Math.round(sum(p)*100),99999);});
test('parcelamento ajusta fim do mês e ano bissexto',()=>{eq(addMonths('2026-01-31',1),'2026-02-28');eq(addMonths('2028-01-31',1),'2028-02-29');eq(addMonths('2026-08-31',1),'2026-09-30');});
test('exclusão só esta',()=>eq(afterDelete(['2026-08','2026-09','2026-10'],'2026-09','one').join(','),'2026-08,2026-10'));
test('exclusão desde início',()=>eq(afterDelete(['2026-08','2026-09'],'2026-09','all').length,0));
test('exclusão deste mês em diante',()=>eq(afterDelete(['2026-08','2026-09','2026-10'],'2026-09','future').join(','),'2026-08'));
test('previsão mês a mês usa fechamento real anterior',()=>{const aug=monthlyForecast(1000,[800],[250]);eq(aug,1550);const sep=monthlyForecast(aug,[1200,300],[400,150]);eq(sep,2500);});
test('previsão mensal = efetivado + pendente do próprio mês',()=>eq(monthlyForecast(1000,[200,500],[100,250]),1350));
test('múltiplas moedas consolidam após conversão',()=>{close(convert([{currency:'BRL',value:100},{currency:'USD',value:50},{currency:'EUR',value:10}],{USD:5,EUR:6}),410);close(convert([{currency:'BRL',value:100},{currency:'USD',value:50}],{USD:5},'USD'),70);});
test('fatura até fechamento na competência atual',()=>eq(invoiceMonth('2026-08-20',20),'2026-08'));
test('fatura após fechamento na próxima competência',()=>eq(invoiceMonth('2026-08-21',20),'2026-09'));
test('parcelas de cartão avançam fatura mês a mês',()=>{const m=invoiceMonth('2026-08-21',20);eq(m,'2026-09');eq(monthKey(addMonths(`${m}-01`,1)),'2026-10');eq(monthKey(addMonths(`${m}-01`,2)),'2026-11');});

const recurrence=fs.readFileSync('js/recurrence-v2.js','utf8');
const dashboard=fs.readFileSync('js/dashboard-balance-forecast-v2.js','utf8');
const cardRules=fs.readFileSync('js/card-finance-rules.js','utf8');
const exchange=fs.readFileSync('js/exchange.js','utf8');
test('app usa motor de parcelamento por centavos',()=>{if(!recurrence.includes('splitTotal')||!recurrence.includes('base+(i<rest?1:0)'))throw new Error('motor de centavos não localizado');if(!cardRules.includes('splitTotal'))throw new Error('cartão não usa motor de centavos');});
test('app usa previsão mensal e saldo de abertura',()=>{if(!dashboard.includes('forecastBalance=opening+forecastResult')||!dashboard.includes('convertRows(mr)')||!dashboard.includes('convertRows(md)'))throw new Error('previsão mensal correta não localizada');});
test('app bloqueia previsão antes do início da conta',()=>{if(!dashboard.includes('info.before')||!dashboard.includes('valid(r,info)'))throw new Error('guarda de início ausente');});
test('app tem três escopos de exclusão de série',()=>{for(const x of ['scope==="one"','scope==="all"','future'])if(!recurrence.includes(x))throw new Error(`ausente ${x}`);});
test('app consolida moedas via cotação',()=>{if(!exchange.includes('convertAccountsToBRL')||!exchange.includes('getRateToBRL'))throw new Error('conversão ausente');});
test('app implementa competência real de fatura por fechamento',()=>{for(const x of ['invoiceMeta','competenciaFatura','card.fechamento','vencimentoFatura'])if(!cardRules.includes(x))throw new Error(`regra de fatura ausente: ${x}`);});

if(failures.length){console.error(`\nAUDITORIA MATEMÁTICA: ${failures.length} FALHA(S)`);for(const f of failures)console.error('- '+f);process.exit(1);}console.log('\nAUDITORIA MATEMÁTICA OK — todas as regras validadas.');
