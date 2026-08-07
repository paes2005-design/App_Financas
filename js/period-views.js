import { createMonthNavigator } from "./period.js";

const content=document.getElementById("content");
const placeholder=document.getElementById("placeholderView");

function createView(id,title,message){
  let view=document.getElementById(id);
  if(view)return view;
  view=document.createElement("div");
  view.id=id;
  view.className="app-view hidden";
  view.innerHTML=`<div id="${id}MonthNavigator"></div><article class="panel"><h3>${title}</h3><p class="empty-state">${message}</p></article>`;
  content.insertBefore(view,placeholder);
  createMonthNavigator(id,document.getElementById(`${id}MonthNavigator`));
  return view;
}

createView("despesas","Despesas do mês","Nenhuma despesa cadastrada neste mês.");
createView("transferencias","Transferências do mês","Nenhuma transferência cadastrada neste mês.");
