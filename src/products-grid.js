// Catálogo CDSB: apresentação compacta da mesma família/SKU, sem ações cadastrais na lista.
export function productCatalogCard(group,{h,qtyStore,qtyReserved,qtyAvailable,categories=[]}){
 const products=group.products.filter(p=>p.active);
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
 const sku=group.modelId?products.length+' variação(ões)':'SKU '+(main?.sku||'—')+' · EAN '+(main?.ean||'—');
 const inactive=products.length===0;
 return '<article class="product-grid-card'+(inactive?' is-inactive':'')+'" data-product-card="'+h(group.key)+'">'+
  '<div class="product-grid-main"><div class="product-grid-media">'+photo+'</div>'+
   '<div class="product-grid-copy"><small>'+h(sku)+'</small>'+
    '<h3>'+h(group.title)+'</h3><span class="product-grid-subtitle">'+h(category)+' · '+h(location)+'</span></div></div>'+
  '<div class="product-grid-stock">'+
   '<div><small>Disponível</small><strong>'+available.toLocaleString('pt-BR')+'</strong></div>'+
   '<div><small>Físico</small><strong>'+physical.toLocaleString('pt-BR')+'</strong></div>'+
   '<div><small>Reservado</small><strong>'+reserved.toLocaleString('pt-BR')+'</strong></div>'+
  '</div>'+
  '<button type="button" class="button primary product-grid-open" data-action="product-drawer-open" data-group="'+h(group.key)+'" aria-label="Abrir produto '+h(group.title)+'">Abrir produto</button>'+
 '</article>';
}
