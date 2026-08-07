import { auth, db } from "./firebase.js";
import { formatMoney, getMoneyCurrency, getMoneyValue, resetMoneyField } from "./money.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const BANCOS = {
  bb: { nome: "Banco do Brasil", simbolo: "BB", cor: "#f8d117", segmento: "S1" },
  bradesco: { nome: "Bradesco", simbolo: "BRA", cor: "#cc092f", segmento: "S1" },
  btg: { nome: "BTG Pactual", simbolo: "BTG", cor: "#123c69", segmento: "S1" },
  caixa: { nome: "Caixa Econômica Federal", simbolo: "CEF", cor: "#005ca9", segmento: "S1" },
  itau: { nome: "Itaú", simbolo: "IT", cor: "#ec7000", segmento: "S1" },
  santander: { nome: "Santander", simbolo: "SAN", cor: "#ec0000", segmento: "S1" },
  banrisul: { nome: "Banrisul", simbolo: "BRS", cor: "#00529b", segmento: "S2" },
  bnb: { nome: "Banco do Nordeste", simbolo: "BNB", cor: "#00529b", segmento: "S2" },
  bndes: { nome: "BNDES", simbolo: "BND", cor: "#16834b", segmento: "S2" },
  citi: { nome: "Citibank", simbolo: "CITI", cor: "#056dae", segmento: "S2" },
  "credit-suisse": { nome: "Credit Suisse", simbolo: "CS", cor: "#17365d", segmento: "S2" },
  safra: { nome: "Banco Safra", simbolo: "SAF", cor: "#b69324", segmento: "S2" },
  bv: { nome: "Banco BV", simbolo: "BV", cor: "#2446f5", segmento: "S2" }
};

const form = document.getElementById("contaForm");
const bancoInput = document.getElementById("contaBanco");
const nomeLivreGrupo = document.getElementById("contaNomeLivreGrupo");
const nomeLivreInput = document.getElementById("contaNomeLivre");
const tipoInput = document.getElementById("contaTipo");
const saldoInput = document.getElementById("contaSaldoInicial");
const lista = document.getElementById("listaContas");
const mensagem = document.getElementById("contaMensagem");
const saldoTotal = document.getElementById("saldoTotal");

let usuarioAtual = null;
let pararEscuta = null;

function mostrarMensagem(texto = "", tipo = "") {
  mensagem.textContent = texto;
  mensagem.className = `message ${tipo}`.trim();
}

function escapeHtml(valor = "") {
  return String(valor).replace(/[&<>'"]/g, (caractere) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[caractere]);
}

function obterDadosInstituicao() {
  const chave = bancoInput.value;
  if (chave === "outro") {
    const nome = nomeLivreInput.value.trim();
    return { chave: "outro", nome, simbolo: nome ? nome.slice(0, 3).toUpperCase() : "OUT", cor: "#607d8b", segmento: "Livre" };
  }
  const banco = BANCOS[chave];
  return banco ? { chave, ...banco } : null;
}

function renderizarContas(contas) {
  const totalBRL = contas
    .filter((conta) => (conta.moeda || "BRL") === "BRL")
    .reduce((soma, conta) => soma + Number(conta.saldoInicial || 0), 0);
  saldoTotal.textContent = formatMoney(totalBRL, "BRL");

  if (!contas.length) {
    lista.innerHTML = '<div class="empty-state">Nenhuma conta cadastrada.</div>';
    return;
  }

  lista.innerHTML = contas.map((conta) => {
    const moeda = conta.moeda || "BRL";
    return `
      <article class="account-item">
        <div class="account-main">
          <span class="bank-symbol" style="--bank-color:${escapeHtml(conta.cor || "#607d8b")}">${escapeHtml(conta.simbolo || "CTA")}</span>
          <div><strong>${escapeHtml(conta.nome)}</strong><span>${escapeHtml(conta.tipo)}${conta.segmento ? ` · ${escapeHtml(conta.segmento)}` : ""} · ${escapeHtml(moeda)}</span></div>
        </div>
        <div class="account-value">
          <strong>${formatMoney(conta.saldoInicial, moeda)}</strong>
          <button type="button" class="delete-account" data-id="${conta.id}" aria-label="Excluir ${escapeHtml(conta.nome)}">Excluir</button>
        </div>
      </article>`;
  }).join("");

  lista.querySelectorAll(".delete-account").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!usuarioAtual || !confirm("Excluir esta conta?")) return;
      try {
        await deleteDoc(doc(db, "users", usuarioAtual.uid, "contas", button.dataset.id));
      } catch (error) {
        mostrarMensagem("Não foi possível excluir a conta.", "error");
        console.error(error);
      }
    });
  });
}

bancoInput.addEventListener("change", () => {
  const livre = bancoInput.value === "outro";
  nomeLivreGrupo.classList.toggle("hidden", !livre);
  nomeLivreInput.required = livre;
  if (!livre) nomeLivreInput.value = "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  mostrarMensagem();

  if (!usuarioAtual) {
    mostrarMensagem("Faça login para cadastrar uma conta.", "error");
    return;
  }

  const instituicao = obterDadosInstituicao();
  const tipo = tipoInput.value;
  const saldoInicial = getMoneyValue(saldoInput);
  const moeda = getMoneyCurrency(saldoInput);

  if (!instituicao) {
    mostrarMensagem("Selecione um banco ou a opção de nome livre.", "error");
    return;
  }
  if (!instituicao.nome) {
    mostrarMensagem("Informe o nome da conta.", "error");
    return;
  }
  if (!Number.isFinite(saldoInicial)) {
    mostrarMensagem("Informe um saldo inicial válido.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "users", usuarioAtual.uid, "contas"), {
      bancoId: instituicao.chave,
      nome: instituicao.nome,
      simbolo: instituicao.simbolo,
      cor: instituicao.cor,
      segmento: instituicao.segmento,
      tipo,
      saldoInicial,
      moeda,
      ativa: true,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });

    form.reset();
    nomeLivreGrupo.classList.add("hidden");
    nomeLivreInput.required = false;
    resetMoneyField(saldoInput, "BRL");
    mostrarMensagem("Conta cadastrada com sucesso.", "success");
  } catch (error) {
    mostrarMensagem("Não foi possível cadastrar a conta.", "error");
    console.error(error);
  }
});

onAuthStateChanged(auth, (user) => {
  usuarioAtual = user;
  if (pararEscuta) pararEscuta();
  if (!user) {
    renderizarContas([]);
    return;
  }

  const contasQuery = query(collection(db, "users", user.uid, "contas"), orderBy("criadoEm", "desc"));
  pararEscuta = onSnapshot(contasQuery, (snapshot) => {
    renderizarContas(snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() })));
  }, (error) => {
    mostrarMensagem("Não foi possível carregar as contas.", "error");
    console.error(error);
  });
});
