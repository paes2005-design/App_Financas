import { auth } from "./firebase.js";
import { criarOuAtualizarPerfil } from "./firestore.js";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const elements = {
  loading: document.getElementById("loading"),
  loginPage: document.getElementById("loginPage"),
  appPage: document.getElementById("appPage"),
  authForm: document.getElementById("authForm"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  btnLogin: document.getElementById("btnLogin"),
  btnCadastrar: document.getElementById("btnCadastrar"),
  btnRecuperar: document.getElementById("btnRecuperar"),
  btnLogout: document.getElementById("btnLogout"),
  mensagem: document.getElementById("mensagem"),
  userEmail: document.getElementById("userEmail")
};

function setBusy(busy) {
  elements.btnLogin.disabled = busy;
  elements.btnCadastrar.disabled = busy;
}

function mostrarMensagem(texto = "", tipo = "") {
  elements.mensagem.textContent = texto;
  elements.mensagem.className = `message ${tipo}`.trim();
}

function validarCampos() {
  const email = elements.email.value.trim();
  const password = elements.password.value;

  if (!email) throw new Error("Informe o e-mail.");
  if (!password || password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");

  return { email, password };
}

function mensagemAmigavel(error) {
  const code = error?.code ?? "";
  const messages = {
    "auth/email-already-in-use": "Este e-mail já possui uma conta.",
    "auth/invalid-email": "O e-mail informado é inválido.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/missing-password": "Informe a senha.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/unauthorized-domain": "Este domínio ainda não foi autorizado no Firebase Authentication."
  };
  return messages[code] ?? error?.message ?? "Não foi possível concluir a operação.";
}

async function login() {
  try {
    setBusy(true);
    mostrarMensagem();
    const { email, password } = validarCampos();
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    mostrarMensagem(mensagemAmigavel(error), "error");
  } finally {
    setBusy(false);
  }
}

async function cadastrar() {
  try {
    setBusy(true);
    mostrarMensagem();
    const { email, password } = validarCampos();
    await createUserWithEmailAndPassword(auth, email, password);
    mostrarMensagem("Conta criada com sucesso.", "success");
  } catch (error) {
    mostrarMensagem(mensagemAmigavel(error), "error");
  } finally {
    setBusy(false);
  }
}

async function recuperarSenha() {
  const email = elements.email.value.trim();
  if (!email) {
    mostrarMensagem("Informe seu e-mail para receber a recuperação.", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    mostrarMensagem("E-mail de recuperação enviado.", "success");
  } catch (error) {
    mostrarMensagem(mensagemAmigavel(error), "error");
  }
}

elements.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login();
});
elements.btnCadastrar.addEventListener("click", cadastrar);
elements.btnRecuperar.addEventListener("click", recuperarSenha);
elements.btnLogout.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  elements.loading.classList.add("hidden");

  if (!user) {
    elements.appPage.classList.add("hidden");
    elements.loginPage.classList.remove("hidden");
    elements.userEmail.textContent = "";
    return;
  }

  try {
    await criarOuAtualizarPerfil(user);
  } catch (error) {
    console.error("Erro ao gravar perfil:", error);
    mostrarMensagem("Login efetuado, mas não foi possível atualizar o perfil no Firestore.", "error");
  }

  elements.userEmail.textContent = user.email ?? "Usuário autenticado";
  elements.loginPage.classList.add("hidden");
  elements.appPage.classList.remove("hidden");
});
