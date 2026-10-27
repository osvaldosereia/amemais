// Catálogo CDSB: apresentação compacta da mesma família/SKU, sem ações cadastrais na lista.
const sizeOrder=['PP','P','M','G','GG','XGG','XXGG','EXGG'];
const sizeCollator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
const variantName=p=>{
 const size=String(p.apparel_size||'Único').replace(/^tamanho\s+/i,'').trim()||'Único';
 const color=String(p.apparel_color||'').trim();
 return color&&color.toLocaleLowerCase('pt-BR')!=='única'?size+' · '+color:size;
};
export function productCardVariantStock(products,{h,qtyAvailable}){
 const ordered=[...products].sort((a,b)=>{
  const aName=variantName(a),bName=variantName(b);
  const ar=sizeOrder.indexOf(aName.split(' · ')[0].toUpperCase());
  const br=sizeOrder.indexOf(bName.split(' · ')[0].toUpperCase());
  return (ar<0?99:ar)-(br<0?99:br)||
   sizeCollator.compare(aName,bName)||sizeCollator.compare(String(a.sku||a.id||''),String(b.sku||b.id||''));
 });
 return '<section class="product-grid-variants" aria-label="Estoque disponível por variação">'+
  '<div class="product-grid-variants-head"><strong>Estoque por variação</strong><small>Disponível</small></div>'+
  '<div class="product-grid-variants-list">'+ordered.map(p=>{
   const qty=Math.max(0,Number(qtyAvailable(p.id))||0),size=variantName(p),label=size+(p.active?'':' · Inativo');
   return '<div class="product-grid-variant'+(qty===0?' is-zero':'')+'" title="'+h(label+': '+qty+' unidades disponíveis')+'">'+
    '<span class="product-grid-variant-name">'+h(label)+'</span>'+
    '<b class="product-grid-variant-qty" aria-label="'+h(qty+' unidades disponíveis')+'">'+qty.toLocaleString('pt-BR')+'</b></div>';
  }).join('')+'</div></section>';
}
export function productCatalogCard(group,{h,qtyStore,qtyReserved,qtyAvailable,categories=[]}){
 const products=group.products.filter(p=>!p.force_archived_at);
 const main=group.products.find(p=>p.image_path||p.image_paths?.length)||group.main;
 const imagePath=main?.image_path||main?.image_paths?.[0]||group.model?.image_path||group.model?.image_paths?.[0];
 const photo=imagePath?'<img class="product-grid-photo" data-photo-path="'+h(imagePath)+'" loading="lazy" alt="Foto de '+h(group.title)+'">':
  '<div class="product-grid-placeholder" aria-label="Sem foto">▧</div>';
 const available=products.reduce((n,p)=>n+Math.max(0,Number(qtyAvailable(p.id)||0)),0);
 const physical=products.reduce((n,p)=>n+Math.max(0,Number(qtyStore(p.id)||0)),0);
 const reserved=products.reduce((n,p)=>n+Math.max(0,Number(qtyReserved(p.id)||0)),0);
 const locations=[...new Set(products.map(p=>[p.gondola?'Gôndola '+p.gondola:'',p.prateleira?'Prateleira '+p.prateleira:''].filter(Boolean).join(' · ')).filter(Boolean))];
 const location=locations.length>1?'Localizações por variação':locations[0]||'Gôndola não informada';
 const category=categories.find(c=>c.id===(group.model?.category_id||main?.category_id))?.name||'Sem categoria';
 const inactiveCount=products.filter(p=>!p.active).length;
 const sku=group.modelId?products.length+' variação(ões)':'SKU '+(main?.sku||'—')+' · EAN '+(main?.ean||'—');
 const inactive=products.length>0&&inactiveCount===products.length;
 return '<article class="product-grid-card'+(inactive?' is-inactive':'')+'" data-product-card="'+h(group.key)+'">'+
  '<div class="product-grid-main"><div class="product-grid-media">'+photo+'</div>'+
   '<div class="product-grid-copy"><small>'+h(sku)+'</small>'+
    '<h3>'+h(group.title)+'</h3><span class="product-grid-subtitle">'+h(category)+' · '+h(location)+
    (inactiveCount?' · '+inactiveCount+' '+(inactiveCount===1?'variação inativa':'variações inativas'):'')+'</span></div></div>'+
  '<div class="product-grid-stock">'+
   '<div><small>Disponível</small><strong>'+available.toLocaleString('pt-BR')+'</strong></div>'+
   '<div><small>Físico</small><strong>'+physical.toLocaleString('pt-BR')+'</strong></div>'+
   '<div><small>Reservado</small><strong>'+reserved.toLocaleString('pt-BR')+'</strong></div>'+
  '</div>'+productCardVariantStock(products,{h,qtyAvailable})+
  '<button type="button" class="button primary product-grid-open" data-action="product-drawer-open" data-group="'+h(group.key)+'" aria-label="Abrir produto '+h(group.title)+'">Abrir produto</button>'+
 '</article>';
}
