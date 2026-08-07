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
async function shownBalance(){await nav('dashboard');const el=page.locator('#saldoTotal');await vis('#saldoTotal');let txt=await el.innerText();if(/•/.test(txt)){await page.click('#dashboardValueToggle');txt=await el.innerText();}return txt.trim();}
await login();
const before=await shownBalance();
await nav('receitas');
await page.fill('#receitaDescricao',desc);await page.fill('#receitaValor','77,77');await choose('#receitaConta','QA Conta A');await choose('#receitaCategoria','QA Geral');await page.click('#salvarReceita');
await page.waitForFunction(t=>document.querySelector('#listaReceitas')?.innerText.includes(t),desc,{timeout:12000});
let item=page.locator('.transaction-item').filter({hasText:desc}).first();
let badge=item.locator('.operation-status');await badge.waitFor({state:'visible',timeout:12000});
if((await badge.innerText()).trim()!=='Pendente'||!(await badge.evaluate(el=>el.classList.contains('pending'))))throw new Error('status inicial não ficou Pendente/azul');
await item.locator('.txn-more').click();let menu=item.locator('.txn-menu.open');if(!(await menu.innerText()).includes('Efetivar'))throw new Error('operação pendente não oferece Efetivar');
await menu.getByText('Efetivar',{exact:true}).click();await vis('#settlementModal');page.once('dialog',d=>d.accept());await page.click('#settlementModal .settlement-confirm');
await page.waitForFunction(t=>{const row=[...document.querySelectorAll('.transaction-item')].find(x=>x.textContent.includes(t));return row?.querySelector('.operation-status')?.textContent.trim()==='Efetivado';},desc,{timeout:12000});
item=page.locator('.transaction-item').filter({hasText:desc}).first();badge=item.locator('.operation-status');if(!(await badge.evaluate(el=>el.classList.contains('effective'))))throw new Error('status efetivado não ficou verde');
await item.locator('.txn-more').click();menu=item.locator('.txn-menu.open');if(!(await menu.innerText()).includes('Desefetivar'))throw new Error('operação efetivada não oferece Desefetivar');
const afterSettle=await shownBalance();if(afterSettle===before)throw new Error('saldo não mudou após efetivar a receita');
await nav('receitas');item=page.locator('.transaction-item').filter({hasText:desc}).first();await item.locator('.txn-more').click();menu=item.locator('.txn-menu.open');page.once('dialog',d=>d.accept());await menu.getByText('Desefetivar',{exact:true}).click();
await page.waitForFunction(t=>{const row=[...document.querySelectorAll('.transaction-item')].find(x=>x.textContent.includes(t));return row?.querySelector('.operation-status')?.textContent.trim()==='Pendente';},desc,{timeout:12000});
const afterUndo=await shownBalance();if(afterUndo!==before)throw new Error(`saldo não foi recalculado ao desefetivar: antes=${before} depois=${afterUndo}`);
await browser.close();console.log('AUDITORIA STATUS OK — Pendente azul, Efetivado verde, Desefetivar e recálculo do saldo validados no Firebase.');
