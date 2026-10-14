(()=>{"use strict";
const endpoint="https://awcclxehwzvvgajgpnmf.supabase.co/functions/v1/shared-product";
const token=new URLSearchParams(location.hash.slice(1)).get("t");
const $=id=>document.getElementById(id);
let catalog=[],requestId=null,submitting=false;
const selections=new Map();
const make=(tag,text,klass)=>{const el=document.createElement(tag);if(text!==undefined&&text!==null)el.textContent=String(text);if(klass)el.className=klass;return el};
async function api(payload){
 const r=await fetch(endpoint,{method:"POST",mode:"cors",cache:"no-store",credentials:"omit",
 headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,token})});
 const data=await r.json();if(!r.ok)throw Error(data.error||"Falha na solicitação.");return data;
}
const groups=()=>{const map=new Map();for(const p of catalog){const key=p.model_id||p.id;if(!map.has(key))map.set(key,{key,title:p.title,photo:p.image_url,variants:[]});map.get(key).variants.push(p)}return [...map.values()].sort((a,b)=>a.title.localeCompare(b.title,"pt-BR"))};
function qtyEditor(p){
 const qty=make("div",null,"client-qty"),minus=make("button","−"),plus=make("button","+"),input=document.createElement("input");
 minus.type=plus.type="button";input.type="number";input.inputMode="numeric";input.min="0";input.max="1000";input.step="1";input.value=String(selections.get(p.id)??0);input.dataset.item=p.id;input.setAttribute("aria-label","Quantidade de "+p.title+" "+(p.size||""));
 minus.setAttribute("aria-label","Diminuir");plus.setAttribute("aria-label","Aumentar");
 const sync=()=>{
   const raw=input.value.trim();
   if(raw==="")selections.delete(p.id);
   else selections.set(p.id,/^[0-9]{1,4}$/.test(raw)?Number(raw):NaN);
   updateSummary();
 };
 minus.addEventListener("click",()=>{input.value=String(Math.max(0,(Number(input.value)||0)-1));sync()});
 plus.addEventListener("click",()=>{input.value=String(Math.min(1000,(Number(input.value)||0)+1));sync()});
 input.addEventListener("input",sync);qty.append(minus,input,plus);return qty;
}
function render(query=""){
 const q=query.trim().toLocaleLowerCase("pt-BR"),container=$("client-products");container.replaceChildren();
 const list=groups().filter(g=>!q||[g.title,...g.variants.flatMap(v=>[v.size,v.color,v.sku,v.ean])].join(" ").toLocaleLowerCase("pt-BR").includes(q));
 for(const g of list){
  const card=make("article",null,"client-product"),head=make("div",null,"client-product-head"),picture=make("div",null,"client-photo");
  if(g.photo&&/^https:\/\//.test(g.photo)){const img=document.createElement("img");img.src=g.photo;img.loading="lazy";img.alt="Foto de "+g.title;picture.append(img)}
  else picture.textContent="Foto não disponível";
  const info=make("div",null,"client-product-title");info.append(make("strong",g.title),make("small",g.variants.length+" variação(ões)"));head.append(picture,info);
  const lines=make("div",null,"client-variants");for(const v of g.variants){
   const row=make("div",null,"client-variant"),names=make("div",null,"client-variant-name");
   names.append(make("strong",[v.color,v.size].filter(Boolean).join(" · ")||v.title));
   // O catálogo de cliente não revela saldos ou quantidades físicas.
   names.append(make("small","Código: "+(v.sku||"—")));
   row.append(names,qtyEditor(v));lines.append(row);
  }card.append(head,lines);container.append(card);
 }
 $("client-count").textContent=list.length+" produto(s) encontrado(s)";
 if(!list.length)container.append(make("p","Nenhum produto corresponde à busca."));
 updateSummary();
}
function selected(){
 const items=[];
 for(const [id,n] of selections){
  if(!Number.isInteger(n)||n<0||n>1000)throw Error("Quantidade inválida.");
  if(n>0)items.push({product_id:id,quantity:n});
 }
 return items;
}
function updateSummary(){
 let count=0,total=0;
 for(const n of selections.values()){if(n>0){count++;total+=n;}}
 $("client-order-summary").textContent=count?
   count+" variação(ões), "+total+" unidade(s) no pedido.":"Nenhum item selecionado.";
}
function feedback(msg){$("client-feedback").textContent=msg;$("client-feedback").hidden=false;}
function showSaved(receipt){
 const url=new URL("pedido.html",location.href);url.hash="t="+receipt;url.search="";
 const link=url.toString(),box=$("client-feedback");box.replaceChildren();
 box.append(make("strong","Pedido salvo com sucesso. O comprovante não pode ser editado."));
 const receiptA=make("a","Visualizar pedido registrado");receiptA.href=link;receiptA.target="_blank";receiptA.rel="noopener noreferrer";
 const w=make("a","Compartilhar pedido no WhatsApp","client-whatsapp");w.href="https://wa.me/?text="+encodeURIComponent("Meu pedido Ame+ já está registrado:\n"+link);w.target="_blank";w.rel="noopener noreferrer";
 box.append(receiptA,w);box.hidden=false;$("client-checkout").querySelectorAll("input,button").forEach(x=>x.disabled=true);
 window.open(w.href,"_blank","noopener,noreferrer");
}
$("client-search").addEventListener("input",e=>render(e.target.value));
$("client-checkout").addEventListener("submit",async e=>{
 e.preventDefault();if(submitting)return;
 let items;try{items=selected()}catch(err){feedback(err.message);return;}
 if(!items.length){feedback("Selecione ao menos um produto.");return;}
 if(items.length>40||items.reduce((a,b)=>a+b.quantity,0)>2000){feedback("Limite de 40 variações e 2.000 unidades por pedido.");return;}
 if(!requestId)requestId=crypto.randomUUID();submitting=true;
 const submit=$("client-submit");submit.disabled=true;submit.textContent="Salvando pedido…";
 const form=new FormData(e.currentTarget);
 try{
  const result=await api({action:"catalog_order",name:String(form.get("name")||"").trim(),phone:String(form.get("phone")||"").trim(),items,request_id:requestId});
  if(!result.receipt_token)throw Error("Pedido salvo, mas o comprovante ainda não está disponível. Tente novamente.");
  showSaved(result.receipt_token);
 }catch(err){feedback(err.message||"Não foi possível salvar.");}
 finally{submitting=false;if(!submit.closest("form")?.querySelector("input:disabled"))submit.disabled=false;submit.textContent="Salvar pedido e compartilhar no WhatsApp";}
});
(async()=>{
 try{
  if(!/^[0-9a-f]{64}$/.test(token||""))throw Error("Link inválido. Solicite um novo acesso.");
  const result=await api({action:"catalog"});
  catalog=Array.isArray(result.products)?result.products:[];
  $("client-loading").hidden=true;$("client-content").hidden=false;render();
 }catch(err){$("client-loading").hidden=true;$("client-error").textContent=err.message||"Não foi possível carregar."; $("client-error").hidden=false;}
})();
})();