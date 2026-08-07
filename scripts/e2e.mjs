import { chromium } from 'playwright';

const BASE = 'https://paes2005-design.github.io/App_Financas/';
const EMAIL = 'qa.app.financas.automation@gmail.com';
const PASSWORD = 'QaFinancas2026!';
const stamp = Date.now().toString().slice(-6);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('console', m => {
  if (m.type() === 'error') {
    const t = m.text();
    if (!/favicon|Failed to load resource|ERR_BLOCKED_BY_CLIENT|CORS/i.test(t)) consoleErrors.push(t);
  }
});

async function visible(sel, timeout=10000){ await page.locator(sel).waitFor({ state:'visible', timeout }); }
async function nav(id){
  const btn=page.locator(`.nav-item[data-page="${id}"]`);
  await btn.click();
  await visible(`#${id}`);
  if(await page.locator(`#${id}`).evaluate(el=>el.classList.contains('hidden'))) throw new Error(`Tela ${id} permaneceu oculta`);
}
async function ensureLoggedIn(){
  await page.goto(BASE, { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForLoadState('networkidle', { timeout:15000 }).catch(()=>{});
  await page.locator('#loading').waitFor({state:'hidden',timeout:15000}).catch(()=>{});
  if(await page.locator('#appPage').isVisible()) return;
  await visible('#loginPage');
  await page.fill('#email', EMAIL); await page.fill('#password', PASSWORD);
  await page.click('#btnCadastrar');
  await page.waitForTimeout(1800);
  if(!(await page.locator('#appPage').isVisible())){
    await page.fill('#email', EMAIL); await page.fill('#password', PASSWORD);
    await page.click('#btnLogin');
  }
  await visible('#appPage', 15000);
}
async function selectCustomBank(name,balance){
  await page.click('#bankPickerTrigger');
  await visible('#bankPickerPanel');
  await page.locator('.custom-bank-option').click();
  await page.fill('#contaNomeLivre', name);
  await page.fill('#contaSaldoInicial', balance);
  await page.click('#contaForm button[type="submit"]');
  await page.waitForTimeout(1000);
}
async function ensureAccounts(){
  await nav('contas');
  await page.click('#bankPickerTrigger');
  await page.fill('#bankSearch','BTG');
  await visible('.bank-option[data-bank-id="btg"]');
  await page.click('#bankPickerTrigger').catch(()=>{});
  const body=await page.locator('#listaContas').innerText();
  if(!body.includes('QA Conta A')) await selectCustomBank('QA Conta A','1000,00');
  if(!(await page.locator('#listaContas').innerText()).includes('QA Conta B')) await selectCustomBank('QA Conta B','500,00');
  await page.waitForFunction(()=>document.querySelectorAll('#listaContas .account-item').length>=2,{timeout:15000});
}
async function ensureCategory(){
  await nav('categorias');
  if((await page.locator('#categoryList').innerText()).includes('QA Geral')) return;
  await page.selectOption('#categoryOperation','todos');
  await page.fill('#categoryName','QA Geral');
  await page.fill('#categorySubcategories','Teste, Assinatura');
  await page.click('#categorySubmit');
  await page.waitForFunction(()=>document.querySelector('#categoryList')?.innerText.includes('QA Geral'),{timeout:10000});
}
async function chooseByText(sel,text){
  const loc=page.locator(sel);
  await page.waitForFunction(({sel,text})=>[...document.querySelector(sel)?.options||[]].some(o=>o.textContent.includes(text)),{sel,text},{timeout:10000});
  const value=await loc.locator('option').filter({hasText:text}).first().getAttribute('value');
  await loc.selectOption(value);
}
async function testRevenue(){
  await nav('receitas');
  await chooseByText('#receitaConta','QA Conta A');
  await chooseByText('#receitaCategoria','QA Geral');
  await page.fill('#receitaDescricao',`QA Receita ${stamp}`);
  await page.fill('#receitaValor','123,45');
  await page.click('#salvarReceita');
  await page.waitForFunction(s=>document.querySelector('#listaReceitas')?.innerText.includes(s),`QA Receita ${stamp}`,{timeout:12000});
  const item=page.locator('.transaction-item').filter({hasText:`QA Receita ${stamp}`});
  await item.locator('.txn-more').click();
  const menu=item.locator('.txn-menu.open'); await visible('.txn-menu.open');
  if(!(await menu.innerText()).includes('Editar')) throw new Error('Menu de receita sem Editar');
  if(!(await menu.innerText()).includes('Efetivar')) throw new Error('Menu de receita sem Efetivar');
  await menu.getByText('Efetivar').click();
  await visible('#settlementModal');
  page.once('dialog', d=>d.accept());
  await page.click('#settlementModal .settlement-confirm');
  await page.waitForTimeout(1500);
  await item.locator('.txn-more').click();
  const menu2=item.locator('.txn-menu.open');
  if((await menu2.innerText()).includes('Efetivar')) throw new Error('Receita continua oferecendo Efetivar após efetivação');
  page.once('dialog', d=>d.accept());
  await menu2.getByText('Excluir').click();
  await page.waitForTimeout(1000);
}
async function testExpense(){
  await nav('despesas');
  await chooseByText('#despesaConta','QA Conta A');
  await chooseByText('#despesaCategoria','QA Geral');
  await page.fill('#despesaDescricao',`QA Despesa ${stamp}`);
  await page.fill('#despesaValor','45,67');
  await page.click('#salvarDespesa');
  await page.waitForFunction(s=>document.querySelector('#listaDespesas')?.innerText.includes(s),`QA Despesa ${stamp}`,{timeout:12000});
  const item=page.locator('.expense-item').filter({hasText:`QA Despesa ${stamp}`});
  await item.locator('.txn-more').click();
  const menu=item.locator('.txn-menu.open');
  if(!(await menu.innerText()).includes('Editar')) throw new Error('Menu de despesa sem Editar');
  page.once('dialog', d=>d.accept());
  await menu.getByText('Excluir').click();
  await page.waitForTimeout(800);
}
async function testTransfer(){
  await nav('transferencias');
  await chooseByText('#transferOrigem','QA Conta A');
  await chooseByText('#transferDestino','QA Conta B');
  await chooseByText('#transferCategoria','QA Geral');
  await page.fill('#transferDescricao',`QA Transfer ${stamp}`);
  await page.fill('#transferValor','10,00');
  await page.click('#transferSalvar');
  await page.waitForFunction(s=>document.querySelector('#listaTransferencias')?.innerText.includes(s),`QA Transfer ${stamp}`,{timeout:12000});
  const item=page.locator('.transfer-item').filter({hasText:`QA Transfer ${stamp}`});
  await item.locator('.txn-more').click();
  if(!(await item.locator('.txn-menu.open').innerText()).includes('Editar')) throw new Error('Menu de transferência sem Editar');
}
async function testCard(){
  await nav('cartoes');
  await page.fill('#cardNome',`QA Card ${stamp}`);
  await chooseByText('#cardConta','QA Conta A');
  await page.selectOption('#cardBandeira','Visa');
  await page.waitForFunction(()=>document.querySelector('#cardMoeda')?.options.length>0,{timeout:10000});
  await page.fill('#cardLimite','1500,00');
  await page.fill('#cardFechamento','20');
  await page.fill('#cardVencimento','28');
  await page.click('#cardSalvar');
  await page.waitForFunction(s=>document.querySelector('#listaCartoes')?.innerText.includes(s),`QA Card ${stamp}`,{timeout:12000});
  const card=page.locator('.credit-card-item').filter({hasText:`QA Card ${stamp}`});
  await card.locator('.edit-card').click();
  if(!(await page.locator('#cardFormTitle').innerText()).includes('Editar')) throw new Error('Editar cartão não abriu formulário');
  await page.click('#cardCancelar');
  page.once('dialog', d=>d.accept());
  await card.locator('.delete-card').click();
  await page.waitForTimeout(800);
}
async function testDashboardAndFilters(){
  await nav('dashboard');
  await visible('#saldoTotal');
  await page.click('#dashboardValueToggle'); await page.click('#dashboardValueToggle');
  await page.click('.dashboard-settings-button'); await visible('.dashboard-settings-panel');
  await page.click('.dashboard-settings-back');
  const label=await page.locator('#dashboardMonthNavigator [data-month-label]').innerText();
  await page.click('#dashboardMonthNavigator [data-month-prev]');
  const prev=await page.locator('#dashboardMonthNavigator [data-month-label]').innerText();
  if(label===prev) throw new Error('Navegação mensal da Dashboard não mudou o mês');
  await page.click('#dashboardMonthNavigator [data-month-current]');
  await nav('receitas');
  await page.click('#receitas .filter-launch'); await visible('.filter-modal:not(.hidden)');
  await page.locator('.filter-modal:not(.hidden) .filter-close').click();
}

try{
  await ensureLoggedIn();
  for(const id of ['dashboard','contas','receitas','despesas','transferencias','cartoes','categorias','orcamentos','objetivos','relatorios','configuracoes']) await nav(id);
  await ensureAccounts();
  await ensureCategory();
  await testRevenue();
  await testExpense();
  await testTransfer();
  await testCard();
  await testDashboardAndFilters();
  await page.waitForTimeout(1500);
  if(pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
  if(consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(' | ')}`);
  console.log('E2E OK: autenticação, 11 módulos, contas, categorias, receita/efetivação/exclusão, despesa, transferência, cartão, dashboard, meses e filtros.');
} finally {
  await browser.close();
}
