// Pesquisa e ordenação do catálogo por modelo, sem separar seus SKUs.
export const catalogSortOptions=[
 ['name-asc','Nome: A a Z'],
 ['name-desc','Nome: Z a A'],
 ['available-desc','Maior estoque disponível'],
 ['available-asc','Menor estoque disponível'],
 ['physical-desc','Maior estoque físico'],
 ['physical-asc','Menor estoque físico'],
 ['gondola','Ordem das gôndolas'],
 ['recent','Cadastrados recentemente']
];
const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
export const normalizedText=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export const gondolaKey=x=>normalizedText(x).replace(/^gondola\s*[:#-]?\s*/,'').replace(/^0+(?=[0-9])/,'').trim();
export const gondolaLabel=x=>'Gôndola '+String(x??'').trim().replace(/^g[oô]ndola\s*[:#-]?\s*/i,'').replace(/^0+(?=[0-9])/,'');
export function availableGondolas(items){
 const byKey=new Map();
 for(const p of items){
  const key=gondolaKey(p.gondola);
  if(key&&!byKey.has(key))byKey.set(key,{key,label:gondolaLabel(p.gondola)});
 }
 return [...byKey.values()].sort((a,b)=>collator.compare(a.label,b.label));
}
export function catalogMatchesQuery(product,query,modelName=''){
 const terms=normalizedText(query).split(/\s+/).filter(Boolean);
 if(!terms.length)return true;
 const searchable=normalizedText([
  product.name,modelName,product.sku,product.ean,product.apparel_color,
  product.apparel_size,product.gondola,product.prateleira,...(product.tags||[])
 ].join(' '));
 return terms.every(term=>searchable.includes(term));
}
const quantityFor=(group,fn)=>group.products.filter(p=>p.active)
 .reduce((sum,p)=>sum+Math.max(0,Number(fn(p.id))||0),0);
export function orderCatalogGroups(groups,sort='name-asc',qtyAvailable=()=>0,qtyStore=()=>0){
 const location=g=>g.products.map(p=>gondolaKey(p.gondola)).filter(Boolean)
  .sort(collator.compare.bind(collator))[0]||null;
 const byName=(a,b)=>collator.compare(a.title,b.title)||collator.compare(a.key,b.key);
 const byQty=(a,b,fn,descending)=>{
  const delta=quantityFor(a,fn)-quantityFor(b,fn);
  return (descending?-delta:delta)||byName(a,b);
 };
 return [...groups].sort((a,b)=>{
  switch(sort){
   case 'name-desc':return -byName(a,b);
   case 'available-desc':return byQty(a,b,qtyAvailable,true);
   case 'available-asc':return byQty(a,b,qtyAvailable,false);
   case 'physical-desc':return byQty(a,b,qtyStore,true);
   case 'physical-asc':return byQty(a,b,qtyStore,false);
   case 'gondola':{
    const ga=location(a),gb=location(b);
    if(!ga)return gb?1:byName(a,b);
    if(!gb)return -1;
    return collator.compare(ga,gb)||byName(a,b);
   }
   case 'recent':{
    const latest=g=>g.products.reduce((acc,p)=>String(p.created_at||'')>acc?String(p.created_at):acc,'');
    return latest(b).localeCompare(latest(a))||byName(a,b);
   }
   default:return byName(a,b);
  }
 });
}
export function filterCatalogGondola(groups,gondola=''){
 if(!gondola)return groups;
 return groups.filter(g=>g.products.some(p=>gondolaKey(p.gondola)===gondola));
}
