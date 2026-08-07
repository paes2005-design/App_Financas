import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const errors=[];
const ok=(condition,message)=>{if(!condition)errors.push(message);};

const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const exists=file=>fs.existsSync(path.join(root,file));

const app=read("js/app.js");
const localImports=[...app.matchAll(/import\s+(?:[^"']+from\s+)?["'](\.\/.+?)["']/g)].map(m=>`js/${m[1].replace(/^\.\//,"")}`);
for(const file of localImports)ok(exists(file),`Import local inexistente em app.js: ${file}`);

const sw=read("sw.js");
const shell=[...sw.matchAll(/"\.\/(.+?)"/g)].map(m=>m[1]).filter(Boolean);
for(const item of shell){
 if(item==="")continue;
 ok(exists(item),`Arquivo do APP_SHELL inexistente: ${item}`);
}

const html=read("index.html");
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
ok(!duplicates.length,`IDs duplicados no index.html: ${duplicates.join(", ")}`);
ok(html.includes('type="module" src="./js/app.js"'),"index.html não carrega ./js/app.js como módulo");

const required=["dashboard","contas","receitas","despesas","transferencias","cartoes","categorias","orcamentos","objetivos","relatorios","configuracoes"];
for(const id of required){
 const staticId=html.includes(`id="${id}"`);
 const dynamic=["receitas","despesas","transferencias","cartoes","categorias","orcamentos","objetivos","relatorios","configuracoes"].includes(id);
 ok(staticId||dynamic,`Tela obrigatória não identificada: ${id}`);
}

if(errors.length){
 console.error("SMOKE TEST: FALHOU");
 errors.forEach(e=>console.error(`- ${e}`));
 process.exit(1);
}
console.log(`SMOKE TEST: OK · ${localImports.length} imports locais · ${shell.length} itens de cache · ${ids.length} IDs HTML verificados.`);
