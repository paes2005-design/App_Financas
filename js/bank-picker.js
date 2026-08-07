export const BANKS = [
  ["S1","bb","Banco do Brasil","BB","#f8d117","https://www.bb.com.br/favicon.ico"],["S1","bradesco","Bradesco","BRA","#cc092f","https://banco.bradesco/favicon.ico"],["S1","btg","BTG Pactual","BTG","#123c69","https://www.btgpactual.com/favicon.ico"],["S1","caixa","Caixa Econômica Federal","CEF","#005ca9","https://www.caixa.gov.br/favicon.ico"],["S1","itau","Itaú","IT","#ec7000","https://www.itau.com.br/favicon.ico"],["S1","santander","Santander","SAN","#ec0000","https://www.santander.com.br/favicon.ico"],
  ["S2","sicoob","Banco Sicoob","SIC","#00a091","https://www.sicoob.com.br/favicon.ico"],["S2","banrisul","Banrisul","BRS","#00529b","https://www.banrisul.com.br/favicon.ico"],["S2","sicredi","Banco Cooperativo Sicredi","SCR","#3fae2a","https://www.sicredi.com.br/favicon.ico"],["S2","bnb","Banco do Nordeste","BNB","#00529b","https://www.bnb.gov.br/favicon.ico"],["S2","bndes","BNDES","BND","#16834b","https://www.bndes.gov.br/favicon.ico"],["S2","citi","Citibank","CITI","#056dae","https://www.citibank.com.br/favicon.ico"],["S2","nubank","Nubank / Nu Pagamentos","NU","#820ad1","https://nubank.com.br/favicon.ico"],["S2","safra","Banco Safra","SAF","#b69324","https://www.safra.com.br/favicon.ico"],["S2","bv","Banco BV / Votorantim","BV","#2446f5","https://www.bv.com.br/favicon.ico"],["S2","xp","XP","XP","#111111","https://www.xpi.com.br/favicon.ico"],
  ["S3","abc","Banco ABC Brasil","ABC","#17365d","https://www.abcbrasil.com.br/favicon.ico"],["S3","agibank","Agibank","AGI","#00a651","https://www.agibank.com.br/favicon.ico"],["S3","c6","C6 Bank","C6","#111111","https://www.c6bank.com.br/favicon.ico"],["S3","banestes","Banestes","BAN","#005ca9","https://www.banestes.com.br/favicon.ico"],["S3","banco-amazonia","Banco da Amazônia","BASA","#16834b","https://www.bancoamazonia.com.br/favicon.ico"],["S3","daycoval","Banco Daycoval","DAY","#00529b","https://www.daycoval.com.br/favicon.ico"],["S3","bmg","Banco BMG","BMG","#f37021","https://www.bancobmg.com.br/favicon.ico"],["S3","brb","BRB","BRB","#005ca9","https://novo.brb.com.br/favicon.ico"],["S3","bs2","Banco BS2","BS2","#222222","https://www.bs2.com/favicon.ico"],["S3","inter","Banco Inter","INT","#ff7a00","https://inter.co/favicon.ico"],["S3","mercado-pago","Mercado Pago","MP","#00a8e0","https://www.mercadopago.com.br/favicon.ico"],["S3","mercantil","Banco Mercantil","BM","#17365d","https://bancomercantil.com.br/favicon.ico"],["S3","pagbank","PagBank","PAG","#00a650","https://pagbank.com.br/favicon.ico"],["S3","picpay","PicPay","PIC","#21c25e","https://picpay.com/favicon.ico"],["S3","pine","Banco Pine","PINE","#111111","https://www.pine.com/favicon.ico"],["S3","porto","Porto Bank / Porto Seguro","PORTO","#00a8e0","https://www.portoseguro.com.br/favicon.ico"],["S3","sofisa","Banco Sofisa","SOF","#00529b","https://www.sofisadireto.com.br/favicon.ico"],["S3","stone","Stone","ST","#00a868","https://www.stone.com.br/favicon.ico"],["S3","unicred","Unicred","UNI","#006b4f","https://www.unicred.com.br/favicon.ico"],["S3","ailos","Ailos","AIL","#5f259f","https://www.ailos.coop.br/favicon.ico"],["S3","cresol","Cresol","CRE","#f39200","https://cresol.com.br/favicon.ico"]
].map(([segmento,id,nome,simbolo,cor,logo])=>({segmento,id,nome,simbolo,cor,logo}));

export function getBank(id){ return BANKS.find((bank)=>bank.id===id) || null; }

function normalizeText(value="") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function logoMarkup(bank) {
  return `<span class="bank-logo-wrap" style="--bank-color:${bank.cor}"><img src="${bank.logo}" alt="" loading="lazy"><span class="bank-logo-fallback">${bank.simbolo}</span></span>`;
}

function bankOptionMarkup(bank) {
  return `<button type="button" class="bank-option" data-bank-id="${bank.id}">${logoMarkup(bank)}<span><strong>${bank.nome}</strong><small>Segmento ${bank.segmento}</small></span></button>`;
}

function selectedMarkup(bank) {
  return `${logoMarkup(bank)}<span><strong>${bank.nome}</strong><small>Segmento ${bank.segmento}</small></span>`;
}

export function setBankPickerValue(id) {
  const hidden=document.getElementById("contaBanco");
  const trigger=document.getElementById("bankPickerTrigger");
  if(!hidden || !trigger) return;
  hidden.value=id || "";
  const bank=getBank(id);
  trigger.innerHTML=bank ? selectedMarkup(bank) : id==="outro" ? "<span>✏️ Outro / nome livre</span>" : "<span>🔎 Pesquisar banco ou instituição</span>";
}

export function initBankPicker(){
  const root=document.getElementById("bankPicker");
  if(!root || root.dataset.ready==="true") return;
  root.dataset.ready="true";

  const hidden=document.getElementById("contaBanco");
  const trigger=document.getElementById("bankPickerTrigger");
  const panel=document.getElementById("bankPickerPanel");
  const search=document.getElementById("bankSearch");
  const list=document.getElementById("bankList");

  function render(term="") {
    const query=normalizeText(term);
    const filtered=BANKS.filter((bank)=>{
      const haystack=normalizeText(`${bank.nome} ${bank.simbolo} ${bank.segmento} ${bank.id}`);
      return !query || haystack.includes(query);
    });

    const groups=["S1","S2","S3"].map((segmento)=>{
      const banks=filtered.filter((bank)=>bank.segmento===segmento);
      if(!banks.length) return "";
      return `<section class="bank-group"><h4>Segmento ${segmento}</h4>${banks.map(bankOptionMarkup).join("")}</section>`;
    }).join("");

    list.innerHTML=`${groups || '<p class="bank-empty">Nenhuma instituição encontrada.</p>'}<button type="button" class="bank-option custom-bank-option" data-bank-id="outro"><span class="bank-logo-wrap custom">✏️</span><span><strong>Outro / nome livre</strong><small>Personalizado</small></span></button>`;
  }

  trigger.addEventListener("click",()=>{
    panel.classList.toggle("hidden");
    if(!panel.classList.contains("hidden")) {
      search.value="";
      render("");
      setTimeout(()=>search.focus(),0);
    }
  });

  search.addEventListener("input",()=>render(search.value));

  list.addEventListener("click",(event)=>{
    const button=event.target.closest("[data-bank-id]");
    if(!button) return;
    const id=button.dataset.bankId;
    setBankPickerValue(id);
    hidden.dispatchEvent(new Event("change",{bubbles:true}));
    panel.classList.add("hidden");
  });

  document.addEventListener("click",(event)=>{
    if(!root.contains(event.target)) panel.classList.add("hidden");
  });

  render();
}
