import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export async function criarOuAtualizarPerfil(user) {
  const profileRef = doc(db, "users", user.uid);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    await setDoc(profileRef, {
      uid: user.uid,
      email: user.email ?? "",
      nome: user.displayName ?? "",
      foto: user.photoURL ?? "",
      criadoEm: serverTimestamp(),
      ultimoLogin: serverTimestamp()
    });
    return "Perfil criado no Firestore.";
  }

  await setDoc(profileRef, {
    email: user.email ?? "",
    ultimoLogin: serverTimestamp()
  }, { merge: true });

  return "Último login atualizado no Firestore.";
}
