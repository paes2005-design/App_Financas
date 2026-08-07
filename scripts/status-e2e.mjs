import { chromium } from 'playwright';
const BASE='https://paes2005-design.github.io/App_Financas/';
const EMAIL='qa.app.financas.automation@gmail.com',PASSWORD='QaFinancas2026!';
const tag=Date.now().toString().slice(-6),desc=`QA Status ${tag}`;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1365,height:900}});
async function vis(s,t=15000){await page.locator(s).waitFor({state:'visible',timeout:t});}
async function nav(id){await page.locator(`.nav-item[data-page="${id}"]`).click();await vis(`#${id}`);}
async function choose(sel,text){await page.waitForFunction(({sel,text})=>[...(document.querySelector(sel)?.options||[])].some(o=>o.textContent.includes(text)),{sel,text},{timeout:12000});const o=page.locator(`${sel} option`).filter({hasText:text}).first();await page.locator(sel).selectOption(await o.getAttribute('value'));}
async function login(){await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});await page.locator('#loading').waitFor({state:'hidden',timeout:15000}).catch(()=>{});if(await page.locator('#appPage').isVisible())return;await vis('#loginPage');await page.fill('#email',EMAIL);await page.fill('#password',PASSWORD);await page.click('#btnLogin');await vis('#appPage');}
async function firestoreState(description){return await page.evaluate(async description=>{const {auth,db}=await import('./js/firebase.js');const {collection,getDocs}=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');const uid=auth.currentUser?.uid;if(!uid)throw new Error('usuário Firebase ausente');const receipts=await getDocs(collection(db,'users',uid,'receitas'));const recDoc=receipts.docs.find(d=>d.data().descricao===description);if(!recDoc)return null;const rec={id:recDoc.id,...recDoc.data()};let movementExists=false;if(rec.contaId&&rec.movimentacaoId){const movs=await getDocs(collection(db,'users',uid,'contas',rec.contaId,'movimentacoes'));movementExists=movs.docs.some(d=>d.id===rec.movimentacaoId);}return{efetivada:rec.efetivada===true,planejada:rec.planejada===true,movimentacaoId:rec.movimentacaoId||null,movementExists,valor:Number(rec.valor||0),valorPrevisto:rec.valorPrevisto==null?null:Number(rec.valorPrevisto)};},description);}
await login();
await nav('receitas');
await page.fill('#receitaDescricao',desc);await page.fill('#receitaValor','77,77');await choose('#receitaConta','QA Conta A');await choose('#receitaCategoria','QA Geral');await page.click('#salvarReceita');
await page.waitForFunction(t=>document.querySelector('#listaReceitas')?.innerText.includes(t),desc,{timeout:12000});
let item=page.locator('.transaction-item').filter({hasText:desc}).first();
let badge=item.locator('.operation-status');await badge.waitFor({state:'visible',timeout:12000});
if((await badge.innerText()).trim()!=='Pendente'||!(await badge.evaluate(el=>el.classList.contains('pending'))))throw new Error('status inicial não ficou Pendente/azul');
let state=await firestoreState(desc);if(!state||state.efetivada||!state.planejada)throw new Error('registro inicial não está pendente no Firestore');
await item.locator('.txn-more').click();let menu=item.locator('.txn-menu.open');if(!(await menu.innerText()).includes('Efetivar'))throw new Error('operação pendente não oferece Efetivar');
await menu.getByText('Efetivar',{exact:true}).click();await vis('#settlementModal');page.once('dialog',d=>d.accept());await page.click('#settlementModal .settlement-confirm');
await page.waitForFunction(t=>{const row=[...document.querySelectorAll('.transaction-item')].find(x=>x.textContent.includes(t));return row?.querySelector('.operation-status')?.textContent.trim()==='Efetivado';},desc,{timeout:12000});
item=page.locator('.transaction-item').filter({hasText:desc}).first();badge=item.locator('.operation-status');if(!(await badge.evaluate(el=>el.classList.contains('effective'))))throw new Error('status efetivado não ficou verde');
await item.locator('.txn-more').click();menu=item.locator('.txn-menu.open');if(!(await menu.innerText()).includes('Desefetivar'))throw new Error('operação efetivada não oferece Desefetivar');
state=await firestoreState(desc);if(!state?.efetivada||state.planejada||!state.movimentacaoId||!state.movementExists)throw new Error(`efetivação não criou movimento corretamente: ${JSON.stringify(state)}`);const movementId=state.movimentacaoId;
await nav('receitas');item=page.locator('.transaction-item').filter({hasText:desc}).first();await item.locator('.txn-more').click();menu=item.locator('.txn-menu.open');page.once('dialog',d=>d.accept());await menu.getByText('Desefetivar',{exact:true}).click();
await page.waitForFunction(t=>{const row=[...document.querySelectorAll('.transaction-item')].find(x=>x.textContent.includes(t));return row?.querySelector('.operation-status')?.textContent.trim()==='Pendente';},desc,{timeout:12000});
state=await firestoreState(desc);if(state?.efetivada||!state?.planejada||state.movimentacaoId!==null||state.movementExists)throw new Error(`desefetivação não removeu o realizado: antigo=${movementId} atual=${JSON.stringify(state)}`);if(Math.abs(state.valor-77.77)>.001)throw new Error(`valor previsto não foi restaurado: ${state.valor}`);
await browser.close();console.log('AUDITORIA STATUS OK — Pendente azul, Efetivado verde, Desefetivar e remoção do movimento realizados no Firebase.');
