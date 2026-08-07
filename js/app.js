import "./ui.js";
import "./auth.js";
import "./contas.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      console.info("Service Worker registrado.");
    } catch (error) {
      console.error("Falha ao registrar o Service Worker:", error);
    }
  });
}
