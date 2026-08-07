import { auth, db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { syncRecurrences } from "./recurrence-v3.js";
import { syncCardFixed } from "./card-fixed-sync.js";

let stop=null,timer=null;
onAuthStateChanged(auth,user=>{if(stop){stop();stop=null;}clearTimeout(timer);if(!user)return;stop=onSnapshot(collection(db,"users",user.uid,"recorrencias"),()=>{clearTimeout(timer);timer=setTimeout(()=>{syncRecurrences();syncCardFixed();},80);},error=>console.error("Falha ao observar recorrências:",error));});
