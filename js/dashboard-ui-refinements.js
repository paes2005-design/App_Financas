const style=document.createElement("style");
style.textContent=`
#exchangeStatus{display:none!important}
#dashboardRevenueMini,#dashboardExpenseMini,#dashboardResultMini{grid-template-columns:1fr!important}
#dashboardRevenueMini .balance-mini-item:first-child,#dashboardExpenseMini .balance-mini-item:first-child,#dashboardResultMini .balance-mini-item:first-child{display:none!important}
#dashboardRevenueMini .balance-mini-item:last-child,#dashboardExpenseMini .balance-mini-item:last-child,#dashboardResultMini .balance-mini-item:last-child{text-align:left!important}
`;
document.head.appendChild(style);

function wireBalanceInfo(){
 const value=document.getElementById("saldoTotal"),card=value?.closest(".card"),btn=card?.querySelector(".info-button"),info=document.getElementById("saldoInfoDetalhes");
 if(!btn||!info||btn.dataset.hoverWired)return;
 btn.dataset.hoverWired="1";
 btn.addEventListener("mouseenter",()=>info.classList.remove("hidden"));
 btn.addEventListener("mouseleave",()=>{setTimeout(()=>{if(!info.matches(":hover"))info.classList.add("hidden");},30);});
 info.addEventListener("mouseleave",()=>info.classList.add("hidden"));
}
setTimeout(wireBalanceInfo,0);
new MutationObserver(wireBalanceInfo).observe(document.body,{childList:true,subtree:true});
