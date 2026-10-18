// Carrinho de compras CDSB. Um item corresponde a um SKU/variacao.
export function validPurchaseQty(value){
 const n=Number(value);
 return String(value).trim()!==''&&Number.isInteger(n)&&n>=1&&n<=1000000;
}
export function setPurchaseCartItem(cart,id,value){
 const next=new Map(cart||[]);
 if(!validPurchaseQty(value)){next.delete(id);return next;}
 next.set(id,Number(value));return next;
}
export function cleanPurchaseCart(cart,products=[]){
 const byId=new Map(products.filter(p=>p.active&&!p.force_archived_at)
  .map(p=>[p.id,p]));
 return new Map([...cart].filter(([id,q])=>byId.has(id)&&validPurchaseQty(q)));
}
export function purchaseCartSummary(cart,products=[]){
 const known=new Map(products.map(p=>[p.id,p]));
 const selected=[...cart].filter(([id,q])=>known.get(id)&&validPurchaseQty(q));
 return {skus:selected.length,units:selected.reduce((s,[,q])=>s+Number(q),0),
  suppliers:new Set(selected.map(([id])=>known.get(id).supplier_id).filter(Boolean)).size};
}
export function purchaseCartBySupplier(cart,products=[]){
 const known=new Map(products.map(p=>[p.id,p]));
 const batches=new Map();
 for(const [id,quantity] of cart){
  const p=known.get(id);
  if(!p?.supplier_id||!validPurchaseQty(quantity))continue;
  const lines=batches.get(p.supplier_id)||[];
  lines.push({product:p,quantity:Number(quantity)});
  batches.set(p.supplier_id,lines);
 }
 return batches;
}
export function purchaseCartReviewGroups(cart,products=[],models=[],supplierId=''){
 const modelsById=new Map(models.map(m=>[m.id,m]));
 const lines=purchaseCartBySupplier(cart,products).get(supplierId)||[];
 const groups=new Map();
 for(const line of lines){
  const p=line.product,model=modelsById.get(p.apparel_model_id);
  const key=model?'model:'+model.id:'product:'+p.id;
  if(!groups.has(key))groups.set(key,{key,title:model?.name||p.name,
   photo:model?.image_path||p.image_path||model?.image_paths?.[0]||p.image_paths?.[0]||null,
   supplier_id:supplierId,rows:[],total:0});
  const group=groups.get(key);
  group.rows.push({...p,quantity:line.quantity});
  group.total+=line.quantity;
 }
 return [...groups.values()];
}
export function serializePurchaseCart(cart){
 return JSON.stringify([...cart].filter(([id,n])=>typeof id==='string'&&validPurchaseQty(n))
  .slice(0,2500));
}
export function parsePurchaseCart(value){
 try{
  const rows=JSON.parse(value);
  if(!Array.isArray(rows))return new Map();
  return new Map(rows.filter(row=>Array.isArray(row)&&row.length===2&&
   typeof row[0]==='string'&&validPurchaseQty(row[1])).slice(0,2500));
 }catch{return new Map();}
}
