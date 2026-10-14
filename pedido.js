(()=>{"use strict";
const endpoint="https://awcclxehwzvvgajgpnmf.supabase.co/functions/v1/shared-product";
const token=new URLSearchParams(location.hash.slice(1)).get("t");
const $=id=>document.getElementById(id);
const create=(tag,text,klass)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(klass)el.className=klass;return el};
(async()=>{try{
 if(!/^[0-9a-f]{64}$/.test(token||""))throw Error("Comprovante inválido. Solicite o link correto.");
 const r=await fetch(endpoint,{method:"POST",mode:"cors",cache:"no-store",credentials:"omit",
  headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"receipt",token})});
 const data=await r.json();if(!r.ok)throw Error(data.error||"Pedido não encontrado.");
 $("receipt-name").textContent=data.name||"—";
 $("receipt-phone").textContent=data.phone||"—";
 $("receipt-id").textContent=String(data.id||"").slice(0,8).toUpperCase();
 $("receipt-date").textContent=new Date(data.created_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
 const el=$("receipt-items");let total=0;
 for(const item of data.items||[]){
  const row=create("div",null,"receipt-item"),info=create("div");
  info.append(create("strong",item.name||"Produto"));
  info.append(create("small",[item.color,item.size].filter(Boolean).join(" · ")));
  info.append(create("small","SKU: "+(item.sku||"—")+" · EAN: "+(item.ean||"—")));
  const q=Number(item.quantity)||0;total+=q;row.append(info,create("span",q.toLocaleString("pt-BR")+" un."));el.append(row);
 }
 $("receipt-total").textContent="Total solicitado: "+total.toLocaleString("pt-BR")+" unidade(s)";
 $("receipt-loading").hidden=true;$("receipt-card").hidden=false;
}catch(err){$("receipt-loading").hidden=true;$("receipt-error").textContent=err.message||"Não foi possível abrir o pedido.";$("receipt-error").hidden=false;}})();
})();