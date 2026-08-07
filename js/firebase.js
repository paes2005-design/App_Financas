import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCctN-wg9b6lEL5P2Rdulpcn5xRobTdC_c",
  authDomain: "app-financas-ab7aa.firebaseapp.com",
  projectId: "app-financas-ab7aa",
  storageBucket: "app-financas-ab7aa.firebasestorage.app",
  messagingSenderId: "936220946300",
  appId: "1:936220946300:web:0fccd28f8334e247957ef9"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export { firebaseApp, auth, db };
