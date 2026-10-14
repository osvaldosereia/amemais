(()=>{"use strict";
const endpoint="https://awcclxehwzvvgajgpnmf.supabase.co/functions/v1/shared-product";
const byId=id=>document.getElementById(id);
const token=new URLSearchParams(location.hash.slice(1)).get("t");
const errorEl=byId("error"),loading=byId("loading"),card=byId("shared-card");
let product=null,requestId=null,savedReceipt=null,working=false;
const num=n=>Number(n||0).toLocaleString("pt-BR");
const make=(tag,text,klass)=>{const n=document.createElement(tag);n.textContent=text??"";if(klass)n.className=klass;return n};
async function api(payload){
 const response=await fetch(endpoint,{method:"POST",mode:"cors",cache:"no-store",credentials:"omit",
   headers:{"Content-Type":"application/json"},body:JSON.stringify({token,...payload})});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||"Falha ao consultar o serviço.");
 return data;
}
function showError(message){loading.hidden=true;card.hidden=true;errorEl.textContent=message;errorEl.hidden=false;}
function qtyControl(variant){
 const wrap=make("div",null,"share-order-qty");
 const minus=make("button","−"),input=document.createElement("input"),plus=make("button","+");
 minus.type=plus.type="button";minus.setAttribute("aria-label","Diminuir quantidade");
 plus.setAttribute("aria-label","Aumentar quantidade");
 input.type="number";input.min="0";input.max="1000";input.step="1";input.inputMode="numeric";
 input.value="0";input.dataset.id=variant.product_id;input.setAttribute("aria-label","Quantidade de "+([variant.color,variant.size].filter(Boolean).join(" · ")||variant.name));
 minus.addEventListener("click",()=>input.value=String(Math.max(0,(Number(input.value)||0)-1)));
 plus.addEventListener("click",()=>input.value=String(Math.min(1000,(Number(input.value)||0)+1)));
 wrap.append(minus,input,plus);return wrap;
}
async function load(){
 if(!/^[0-9a-f]{64}$/.test(token||"")){showError("Link inválido. Solicite outro compartilhamento.");return;}
 try{
  product=await api({action:"get"});
  const options=Array.isArray(product.variants)?product.variants:[];
  if(!options.length)throw Error("Produto indisponível.");
  byId("product-title").textContent=product.title||"Produto";
  const total=options.reduce((sum,v)=>sum+(Number(v.stock)||0),0);
  byId("stock-total").textContent=num(total)+" un.";
  const list=byId("variants"),order=byId("order-variants");list.replaceChildren();order.replaceChildren();
  options.forEach(v=>{
   const title=[v.color,v.size].filter(Boolean).join(" · ")||v.name||"Produto";
   const row=make("section",null,"share-variant");
   const left=make("div");left.append(make("h3",title),make("small","Código interno: "+(v.sku||"—")),
     make("small","EAN: "+(v.ean||"—")));
   const q=Number(v.stock)||0;row.append(left,make("span",num(q)+" un.","share-variant-quantity"+(q===0?" zero":"")));list.append(row);
   const choice=make("div",null,"share-order-row");
   choice.append(make("strong",title),qtyControl(v));order.append(choice);
  });
  const photo=byId("shared-photo"),placeholder=byId("no-photo");
  if(product.photo_url&&/^https:\/\//.test(product.photo_url)){
   photo.src=product.photo_url;photo.hidden=false;placeholder.hidden=true;
   photo.onerror=()=>{photo.hidden=true;placeholder.hidden=false};
  }else{photo.removeAttribute("src");photo.hidden=true;placeholder.hidden=false;}
  byId("last-updated").textContent="Estoque consultado em "+new Date(product.updated_at||Date.now()).toLocaleString("pt-BR");
  loading.hidden=true;card.hidden=false;
 }catch(err){showError(err.message||"Não foi possível abrir o produto.");}
}
byId("order-open").addEventListener("click",()=>{
 byId("order-open").hidden=true;byId("order-section").hidden=false;
 byId("order-section").scrollIntoView({behavior:"smooth",block:"start"});
});
function receiptLink(receiptToken){const url=new URL("pedido.html",location.href);url.hash="t="+receiptToken;url.search="";return url.toString();}
function showSaved(url){
 const fb=byId("order-feedback");fb.replaceChildren();
 fb.append(make("strong","Pedido salvo no AME MAIS."));
 const link=document.createElement("a");link.href=url;link.textContent="Ver pedido registrado";link.target="_blank";link.rel="noopener noreferrer";
 const send=make("a","Compartilhar pedido no WhatsApp","share-order-whatsapp");
 send.href="https://wa.me/?text="+encodeURIComponent("Pedido Ame+ registrado. Veja o pedido confirmado (somente leitura):\n"+url);
 send.target="_blank";send.rel="noopener noreferrer";
 fb.append(link,send);fb.hidden=false;byId("order-form").hidden=true;
 // Só abre após confirmação no servidor; se o navegador bloquear, o botão continua disponível.
 window.open(send.href,"_blank","noopener,noreferrer");
}
byId("order-form").addEventListener("submit",async event=>{
 event.preventDefault();if(working||!product)return;
 const form=event.currentTarget,fd=new FormData(form),items=[];
 for(const input of form.querySelectorAll("[data-id]")){
  const raw=input.value.trim(),quantity=Number(raw);
  if(!/^[0-9]{1,4}$/.test(raw)||!Number.isInteger(quantity)||quantity<0||quantity>1000){
   byId("order-feedback").textContent="Corrija as quantidades.";byId("order-feedback").hidden=false;return;
  }
  if(quantity>0)items.push({product_id:input.dataset.id,quantity});
 }
 if(!items.length){byId("order-feedback").textContent="Informe a quantidade de pelo menos uma variação.";byId("order-feedback").hidden=false;return;}
 if(items.reduce((sum,x)=>sum+x.quantity,0)>2000){byId("order-feedback").textContent="Limite de 2.000 unidades por pedido.";byId("order-feedback").hidden=false;return;}
 if(!requestId)requestId=crypto.randomUUID();
 const button=byId("order-submit");working=true;button.disabled=true;button.textContent="Salvando pedido…";
 try{
  const result=await api({action:"place_order",name:String(fd.get("name")||"").trim(),
   phone:String(fd.get("phone")||"").trim(),items,request_id:requestId});
  if(!result.receipt_token)throw Error("Pedido salvo. Tente novamente para obter o comprovante.");
  savedReceipt=receiptLink(result.receipt_token);showSaved(savedReceipt);
 }catch(err){
  const fb=byId("order-feedback");fb.textContent=err.message||"Não foi possível salvar pedido.";fb.hidden=false;
 }finally{working=false;button.disabled=false;button.textContent="Salvar pedido e compartilhar no WhatsApp";}
});
load();
})();