import { auth, db } from "./firebase.js";
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

const form = document.getElementById("contaForm");
const nomeInput = document.getElementById("contaNome");
const tipoInput = document.getElementById("contaTipo");
const saldoInput = document.getElementById("contaSaldoInicial");
const lista = document.getElementById("listaContas");
const mensagem = document.getElementById("contaMensagem");
const saldoTotal = document.getElementById("saldoTotal");

let usuarioAtual = null;
let pararEscuta = null;

const formatarMoeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function mostrarMensagem(texto = "", tipo = "") {
  mensagem.textContent = texto;
  mensagem.className = `message ${tipo}`.trim();
}

function renderizarContas(contas) {
  const total = contas.reduce((soma, conta) => soma + Number(conta.saldoInicial || 0), 0);
  saldoTotal.textContent = formatarMoeda(total);

  if (!contas.length) {
    lista.innerHTML = '<div class="empty-state">Nenhuma conta cadastrada.</div>';
    return;
  }

  lista.innerHTML = contas.map((conta) => `
    <article class="account-item">
      <div>
        <strong>${escapeHtml(conta.nome)}</strong>
        <span>${escapeHtml(conta.tipo)}</span>
      </div>
      <div class="account-value">
        <strong>${formatarMoeda(conta.saldoInicial)}</strong>
        <button type="button" class="delete-account" data-id="${conta.id}" aria-label="Excluir ${escapeHtml(conta.nome)}">Excluir</button>
      </div>
    </article>
  `).join("");

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

function escapeHtml(valor = "") {
  return String(valor).replace(/[&<>'"]/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[caractere]);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  mostrarMensagem();

  if (!usuarioAtual) {
    mostrarMensagem("Faça login para cadastrar uma conta.", "error");
    return;
  }

  const nome = nomeInput.value.trim();
  const tipo = tipoInput.value;
  const saldoInicial = Number(saldoInput.value.replace(",", "."));

  if (!nome) {
    mostrarMensagem("Informe o nome da conta.", "error");
    return;
  }

  if (!Number.isFinite(saldoInicial)) {
    mostrarMensagem("Informe um saldo inicial válido.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "users", usuarioAtual.uid, "contas"), {
      nome,
      tipo,
      saldoInicial,
      ativa: true,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });

    form.reset();
    saldoInput.value = "0";
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

  const contasQuery = query(
    collection(db, "users", user.uid, "contas"),
    orderBy("criadoEm", "desc")
  );

  pararEscuta = onSnapshot(contasQuery, (snapshot) => {
    const contas = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
    renderizarContas(contas);
  }, (error) => {
    mostrarMensagem("Não foi possível carregar as contas.", "error");
    console.error(error);
  });
});
