(()=>{"use strict";
const endpoint="https://awcclxehwzvvgajgpnmf.supabase.co/functions/v1/shared-product";
const lookup=id=>document.getElementById(id);
const token=new URLSearchParams(location.hash.slice(1)).get("t");
const errorEl=lookup("error"),loading=lookup("loading"),card=lookup("shared-card"),refresh=lookup("reload");
function showError(message){loading.hidden=true;card.hidden=true;errorEl.textContent=message;errorEl.hidden=false;}
function line(tag,txt,className){
 const el=document.createElement(tag);el.textContent=txt;if(className)el.className=className;return el;
}
async function render(){
 if(!/^[0-9a-f]{64}$/.test(token||"")){showError("Link inválido. Solicite um novo compartilhamento.");return;}
 loading.hidden=false;card.hidden=true;errorEl.hidden=true;refresh.disabled=true;
 try{
  const response=await fetch(endpoint,{
   method:"POST",mode:"cors",cache:"no-store",credentials:"omit",
   headers:{"Content-Type":"application/json"},body:JSON.stringify({token})
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"Não foi possível carregar o produto.");
  const options=Array.isArray(data.variants)?data.variants:[];
  if(!options.length)throw Error("Produto indisponível.");
  const number=new Intl.NumberFormat("pt-BR");
  lookup("product-title").textContent=data.title||"Produto";
  const total=options.reduce((sum,v)=>sum+(Number(v.stock)||0),0);
  lookup("stock-total").textContent=number.format(total)+" un.";
  const list=lookup("variants");list.replaceChildren();
  options.forEach(v=>{
   const row=document.createElement("section");row.className="share-variant";
   const left=document.createElement("div");
   left.append(line("h3",v.size?[v.color,v.size].filter(Boolean).join(" · "):v.name||"Produto"));
   left.append(line("small","Código interno: "+(v.sku||"—")));
   left.append(line("small","EAN: "+(v.ean||"—")));
   const qty=Number(v.stock)||0;row.append(left,line("span",number.format(qty)+" un.","share-variant-quantity"+(qty===0?" zero":"")));
   list.append(row);
  });
  const photo=lookup("shared-photo"),placeholder=lookup("no-photo");
  if(data.photo_url&&/^https:\/\//.test(data.photo_url)){
   photo.src=data.photo_url;photo.hidden=false;placeholder.hidden=true;
   photo.onerror=()=>{photo.hidden=true;placeholder.hidden=false;};
  }else {photo.removeAttribute("src");photo.hidden=true;placeholder.hidden=false;}
  const time=data.updated_at?new Date(data.updated_at):new Date();
  lookup("last-updated").textContent="Consultado em "+time.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
  loading.hidden=true;card.hidden=false;
 }catch(error){showError(error.message||"Não foi possível consultar o produto.");}
 finally{refresh.disabled=false;}
}
refresh.addEventListener("click",render);
render();
})();
