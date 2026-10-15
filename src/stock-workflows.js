// AME MAIS: consultas agrupadas, inclusão de tamanhos e logística dos eventos.
// Sem estoque paralelo: cada linha representa um produto/variação real.
const sizes=['P','M','G','GG','XGG','XXGG','EXGG','PP','Único'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bySize=(a,b)=>{
  const ai=sizes.indexOf(a.apparel_size),bi=sizes.indexOf(b.apparel_size);
  return (ai<0?100:ai)-(bi<0?100:bi)||
    (ai<0&&bi<0?String(a.apparel_size||'').localeCompare(String(b.apparel_size||''),'pt-BR',{numeric:true}):0)||
    String(a.apparel_color||'').localeCompare(String(b.apparel_color||''),'pt-BR');
};
export function groupInventory(items,models){
  const modelsById=new Map(models.map(x=>[x.id,x])),map=new Map();
  for(const p of items){
    const key=p.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p.id;
    if(!map.has(key))map.set(key,{
      key,modelId:p.apparel_model_id||null,model:modelsById.get(p.apparel_model_id)||null,products:[]
    });
    map.get(key).products.push(p);
  }
  return [...map.values()].map(g=>{
    g.products.sort(bySize);
    g.main=g.products[0];
    g.title=g.model?.name||g.main.name;
    return g;
  }).sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
}
// A home mostra modelos recentes, não uma ficha repetida para cada tamanho/SKU.
// Um SKU recente coloca todo o modelo na seleção, preservando todas as variações.
export function recentInventoryGroups(items,models,limit=6){
  const max=Math.max(0,Math.trunc(Number(limit)||0));
  return groupInventory(items.filter(p=>p.active),models)
    .map(group=>({
      group,
      recentAt:group.products.reduce((latest,p)=>{
        const date=String(p.created_at||'');
        return date>latest?date:latest;
      },'')
    }))
    .sort((a,b)=>b.recentAt.localeCompare(a.recentAt)||
      a.group.title.localeCompare(b.group.title,'pt-BR')||
      a.group.key.localeCompare(b.group.key))
    .slice(0,max).map(entry=>entry.group);
}
// Fotos ordenadas da galeria do modelo (ou do produto, quando mais completa).
// Use somente um conjunto de fotos por card: nunca mistura imagens de SKUs distintos.
export function productGalleryPaths(group){
 const getPaths=record=>{
  if(!record)return [];
  const paths=Array.isArray(record.image_paths)?record.image_paths.filter(v=>typeof v==='string'&&v.trim()):[];
  if(typeof record.image_path==='string'&&record.image_path.trim()&&!paths.includes(record.image_path))
   paths.push(record.image_path);
  return [...new Set(paths)];
 };
 const choices=[group.model,...group.products];
 let selected=[];
 for(const candidate of choices){
  const paths=getPaths(candidate);
  if(paths.length>selected.length)selected=paths;
 }
 return selected;
}
export function groupedCard(group,{h,photoButton,qtyStore,qtyEvent,qtyReserved=()=>0,qtyAvailable=qtyStore,button,isManager,canRegisterProducts,canMoveStock=()=>false,canManageSku=()=>false,canQuickCount=()=>false,canDeleteWholeModel=()=>false,canShare=false,expanded=false,mode='products',eventId=null}){
  // A listagem tem um card por modelo, nunca um card por tamanho.
  const main=group.products.find(p=>p.image_path||p.image_paths?.length)||group.main;
  const galleryPaths=productGalleryPaths(group);
  const photo=galleryPaths.length?
    '<div class="product-photo-gallery" data-product-gallery data-gallery-paths="'+h(JSON.stringify(galleryPaths))+
     '" data-gallery-index="0">'+
       '<button type="button" class="product-photo" data-action="product-gallery-zoom" aria-label="Ampliar foto de '+h(group.title)+'">'+
         '<img class="thumb" data-photo-path="'+h(galleryPaths[0])+'" alt="Foto de '+h(group.title)+'" loading="lazy">'+
       '</button>'+
       (galleryPaths.length>1?'<button type="button" class="product-gallery-arrow prev" data-action="product-gallery-prev" aria-label="Foto anterior de '+h(group.title)+'">‹</button>'+
        '<button type="button" class="product-gallery-arrow next" data-action="product-gallery-next" aria-label="Próxima foto de '+h(group.title)+'">›</button>'+
        '<span class="product-gallery-count" data-gallery-count aria-live="polite">1 / '+galleryPaths.length+'</span>':'')+
     '</div>':photoButton(main);
  const active=group.products.filter(p=>p.active);
  const isProducts=mode==='products';
  const canEdit=isProducts&&canRegisterProducts();
  const canMove=isProducts&&canMoveStock();
  const skuAccess=isProducts&&canManageSku();
  const inlineCount=isProducts&&canQuickCount();
  const manage=isProducts&&isManager();
  const canRemoveEntireModel=isProducts&&Boolean(group.modelId)&&canDeleteWholeModel();
  const quantity=p=>mode==='event'?qtyEvent(p.id,eventId):qtyStore(p.id);
  const count=active.reduce((sum,p)=>sum+quantity(p),0);
  const groupReserved=isProducts?active.reduce((sum,p)=>sum+qtyReserved(p.id),0):0;
  const groupAvailable=isProducts?active.reduce((sum,p)=>sum+qtyAvailable(p.id),0):count;
  const stockLabel=mode==='event'?'Na loja temporária':'Físico na central';
  const colors=[...new Set(active.map(p=>(p.apparel_color||'').trim()).filter(c=>c&&c!=='Única'))];
  const description=group.modelId
    ?(colors.length===1?colors[0]+' · ':colors.length>1?colors.length+' cores · ':'')+
      active.length+' tamanho(s)/variação(ões)'
    :'Produto único';
  const locations=[...new Set(active.map(p=>
    [p.gondola?'Gôndola '+p.gondola:'',p.prateleira?'Prateleira '+p.prateleira:'']
    .filter(Boolean).join(' · ')).filter(Boolean))];
  const location=locations.length>1?'Gôndolas por variação'
    :locations[0]||'Gôndola não informada';
  const locationMissing=locations.length===0;
  const groupEdit=group.modelId?'product-card-edit':'product-edit';
  const groupEditId=group.modelId?group.modelId:main.id;
  const sizeCount=group.products.length;
  const fmt=n=>Number(n||0).toLocaleString('pt-BR');
  const modelRows=()=>{
    return '<div class="group-variant-list">'+group.products.map(p=>{
      const physical=p.active?quantity(p):0;
      const reserved=isProducts?qtyReserved(p.id):0;
      const available=isProducts?qtyAvailable(p.id):physical;
      const label=group.modelId?p.apparel_size||'Único':'Único';
      const loc=[p.gondola?'Gôndola '+p.gondola:'',p.prateleira?'Prateleira '+p.prateleira:''].filter(Boolean).join(' · ');
      const canCount=p.active&&inlineCount,stockHtml=isProducts?
        '<div class="variant-balance-grid">'+
          '<div class="variant-balance-value reserved"><small>Reservado</small><strong>'+fmt(reserved)+'</strong></div>'+
          '<label class="variant-balance-value available"><small>Livre'+(canCount?' · editar':'')+'</small>'+
            (canCount?'<input data-count-free type="number" inputmode="numeric" step="1" min="0" max="1000000" '+
              'value="'+available+'" data-initial="'+available+'" aria-label="Estoque livre · '+h(label)+'">':
              '<strong>'+fmt(available)+'</strong>')+
           '</label>'+
        '</div>':
        '<span class="group-variant-stock"><b>'+fmt(physical)+'</b><small>un.</small></span>';
      return '<div class="group-variant-row'+(!p.active?' product-variant-inactive':'')+
       '" data-product-id="'+h(p.id)+'" data-expected-physical="'+physical+
       '" data-expected-reserved="'+reserved+'">'+
        '<div class="group-variant-name"><span class="product-size-label">'+h(label)+'</span>'+
          '<div class="group-variant-description"><strong>'+h(group.modelId?
            ((p.apparel_color||'')==='Única'?label:(p.apparel_color||label)):(p.name||'Produto'))+'</strong>'+
          '<small class="variant-code">SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</small>'+
          (loc?'<span class="group-variant-location"><span aria-hidden="true">⌖</span>'+h(loc)+'</span>':'')+
          (!p.active?'<small class="product-variant-disabled">Inativo</small>':'')+
          '<small class="stock-variant-physical">Físico: <b>'+fmt(physical)+'</b> un.</small>'+
          '</div></div>'+stockHtml+
        (((skuAccess&&sizeCount>1)||canCount)?'<div class="group-variant-actions">'+
          (canCount?button('✓ Salvar','stock-free-save','data-id="'+h(p.id)+'" hidden','small primary variant-count-save'):'')+
          (skuAccess&&sizeCount>1?button('Gerenciar','sku-manage','data-id="'+h(p.id)+'"','small'):'')+
          '</div>':'')+
        '</div>';
    }).join('')+'</div>';
  };
  // Retrátil responsivo. Só o saldo livre pode ser conferido diretamente, com RPC auditada.
  const moreOptions=(canShare?'<button type="button" data-action="share-product" data-id="'+h(main.id)+'">'+
      'Compartilhar no WhatsApp</button>':'')+

    (group.modelId&&canEdit?'<button type="button" data-action="add-variants" data-id="'+h(group.modelId)+'">+ Adicionar variações</button>':'')+
    (manage?'<button type="button" class="product-menu-danger" data-action="'+
      (group.modelId?'product-card-edit':'product-delete')+'" data-id="'+h(groupEditId)+'">'+
      (group.modelId?'Gerenciar / excluir tamanhos':'Excluir produto')+'</button>':'')+
    (canRemoveEntireModel?'<button type="button" class="product-menu-danger" data-action="product-model-delete" data-id="'+h(group.modelId)+'">Excluir produto completo · todas as variações</button>':'');
  const actions=isProducts?
    '<div class="grouped-inventory-actions">'+
      (sizeCount===1&&skuAccess?button('Gerenciar SKU','sku-manage','data-id="'+h(main.id)+'"','primary'):'')+
      '<button type="button" class="product-card-sizes" data-action="product-card-sizes" data-card-key="'+h(group.key)+'"'+
      ' aria-expanded="'+String(Boolean(expanded))+'">'+(sizeCount===1?'Ver detalhes':(expanded?'Ocultar':'Ver')+' '+sizeCount+' tamanhos')+' <span aria-hidden="true">⌄</span></button>'+
      (moreOptions?'<details class="product-card-more"><summary aria-label="Mais opções do produto" title="Mais opções">⋯</summary>'+
        '<div class="product-card-more-menu">'+moreOptions+'</div></details>':'')+
    '</div>':'';
  return '<article class="grouped-inventory-card product-card-v3" data-product-card="'+h(group.key)+'">'+
    '<div class="grouped-inventory-top">'+
      '<div class="grouped-inventory-photo">'+photo+'</div>'+
      '<div class="grouped-inventory-info">'+
        '<strong class="product-card-name">'+h(group.title)+'</strong>'+
        '<small class="product-card-description">'+h(description)+'</small>'+
        '<div class="product-stock-total '+(count===0?'product-stock-empty':'')+'">'+
          '<small>'+stockLabel+'</small><span><b>'+fmt(count)+'</b> un.</span></div>'+
        '<div class="product-card-location'+(locationMissing?' is-unknown':'')+'" aria-label="Localização do produto">'+
           '<span class="product-location-icon" aria-hidden="true">⌖</span>'+
           '<strong>'+h(location)+'</strong></div>'+
      '</div>'+
      (isProducts?'<div class="stock-total-breakdown">'+
          '<div class="stock-total-metric reserved"><small>Reservado</small><strong>'+fmt(groupReserved)+'</strong><span>un.</span></div>'+
          '<div class="stock-total-metric available"><small>Livre</small><strong>'+fmt(groupAvailable)+'</strong><span>un.</span></div>'+
        '</div>':'')+
    '</div>'+

    (isProducts?actions:'')+
    '<details class="grouped-variants-mobile" data-product-details'+(expanded?' open':'')+'>'+
      '<summary><span>Estoque por '+(group.modelId?'tamanho':'produto')+'</span>'+
      '<span class="group-mobile-total">'+sizeCount+' variação(ões) <span aria-hidden="true">⌄</span></span></summary>'+
      modelRows()+
    '</details>'+
    '</article>';
}
function sizeLine(size){
  return '<div class="add-size-row" data-extra-size="'+esc(size)+'" hidden>'+
    '<div class="add-size-title"><strong>'+size+'</strong><span>Nova variação</span></div>'+
    '<label>SKU <small>(automático se vazio)</small><input name="sku" maxlength="80" disabled placeholder="Gerar automaticamente"></label>'+
    '<label>EAN <small>(opcional)</small><input name="ean" inputmode="numeric" maxlength="14" disabled placeholder="8 a 14 dígitos"></label>'+
    '<label>Estoque inicial<input name="quantity" type="number" inputmode="numeric" min="0" max="1000000" step="1" value="0" disabled required></label></div>';
}
export function addSizesContent(model,variants,choices=[]){
  const color=variants.find(p=>p.active)?.apparel_color||'Única';
  const existing=new Set(variants.filter(p=>p.active&&
    String(p.apparel_color||'').toLocaleLowerCase('pt-BR')===color.toLocaleLowerCase('pt-BR'))
    .map(p=>String(p.apparel_size||'').toLocaleLowerCase('pt-BR')));
  const available=choices.filter(size=>!existing.has(String(size).toLocaleLowerCase('pt-BR')));
  return '<p class="muted">Adicione novas variações permitidas pela categoria. As existentes e seu histórico serão preservados.</p>'+
   '<input type="hidden" name="new_color" value="'+esc(color)+'">'+
   (available.length?
    '<div class="note">Selecione as variações a cadastrar. SKU e EAN podem ser informados individualmente.</div>'+
    '<div class="add-sizes-picker">'+available.map(size=>
      '<button type="button" data-action="extra-size-toggle" data-size="'+esc(size)+
      '" class="size-chip" aria-pressed="false">'+esc(size)+'</button>').join('')+'</div>'+
    '<div class="extra-size-list">'+available.map(sizeLine).join('')+'</div>':
    '<p class="note">Todas as variações da categoria já estão cadastradas, ou a categoria ainda não possui variações. Atualize em Categorias.</p>');
}
export function updateExtraSizeButtons(form,products){
  const color=(form.querySelector('[name="new_color"]')?.value||'Única').trim().toLowerCase();
  for(const btn of form.querySelectorAll('[data-action="extra-size-toggle"]')){
    const taken=products.some(p=>p.active&&p.apparel_size===btn.dataset.size&&String(p.apparel_color).toLowerCase()===color);
    btn.disabled=taken;
    btn.title=taken?'Este tamanho já existe nesta cor':'';
    if(taken){
      const row=form.querySelector('[data-extra-size="'+btn.dataset.size+'"]');
      if(row&&!row.hidden){
        row.hidden=true;row.querySelectorAll('input').forEach(el=>el.disabled=true);
        btn.classList.remove('selected');btn.setAttribute('aria-pressed','false');
      }
    }
  }
}
export function toggleExtraSize(form,size){
  const btn=[...form.querySelectorAll('[data-action="extra-size-toggle"]')].find(el=>el.dataset.size===size);
  const row=[...form.querySelectorAll('[data-extra-size]')].find(el=>el.dataset.extraSize===size);
  if(!btn||!row||btn.disabled)return;
  const enable=row.hidden;
  row.hidden=!enable;btn.classList.toggle('selected',enable);
  btn.setAttribute('aria-pressed',String(enable));
  row.querySelectorAll('input').forEach(el=>el.disabled=!enable);
}
export function collectExtraSizes(form,products){
  const color=(form.querySelector('[name="new_color"]')?.value||'Única').trim();
  if(color.length<2||color.length>40)throw new Error('Informe uma cor válida.');
  const selected=[...form.querySelectorAll('[data-extra-size]')].filter(row=>!row.hidden);
  if(!selected.length)throw new Error('Selecione pelo menos um novo tamanho.');
  return selected.map(row=>{
    const take=n=>(row.querySelector('[name="'+n+'"]')?.value||'').trim();
    const size=row.dataset.extraSize,sku=take('sku')||null,ean=take('ean')||null,raw=take('quantity');
    const quantity=Number(raw);
    if(products.some(p=>p.active&&p.apparel_size===size&&String(p.apparel_color).toLowerCase()===color.toLowerCase()))
      throw new Error('O tamanho '+size+' já existe nessa cor.');
    if(sku&&sku.length>80)throw new Error('SKU muito longo: '+size);
    if(ean&&!/^[0-9]{8,14}$/.test(ean))throw new Error('EAN inválido: '+size);
    if(raw===''||!Number.isInteger(quantity)||quantity<0||quantity>1000000)
      throw new Error('Quantidade inválida: '+size);
    return {size,color,sku,ean,quantity};
  });
}
export function eventBatchContent(items,models,qtyStore,photoButton){
  const groups=groupInventory(items.filter(p=>p.active),models);
  return '<p class="muted">Selecione as quantidades por tamanho. Somente valores maiores que zero serão separados; nada sai da loja antes de confirmar.</p>'+
    '<div class="event-batch-head"><input class="search" type="search" data-event-batch-search placeholder="Buscar por nome, EAN ou SKU" aria-label="Filtrar produtos para transferência">'+
    '<small data-batch-summary>0 unidades selecionadas</small></div>'+
    '<div class="event-batch-list">'+groups.map(g=>{
      return '<section class="event-batch-card" data-batch-group="'+esc(g.key)+'" data-search="'+
        esc([g.title,...g.products.map(p=>[p.name,p.sku,p.ean,p.apparel_color,p.apparel_size].join(' '))].join(' ').toLowerCase())+'">'+
        '<div class="event-batch-product">'+photoButton(g.main)+'<div><strong>'+esc(g.title)+'</strong>'+
        '<small>'+g.products.length+' variação(ões)</small></div></div>'+
        g.products.map(p=>{
          const available=qtyStore(p.id);
          return '<div class="event-batch-variant"><div><strong>'+esc(g.modelId?p.apparel_color+' · '+p.apparel_size:p.name)+'</strong>'+
            '<small>Disponível na loja: '+available+' · '+esc(p.ean||p.sku||'Sem código')+'</small></div>'+
            '<input type="number" name="batch_qty" data-batch-id="'+esc(p.id)+'" min="0" max="'+available+
            '" step="1" value="0" inputmode="numeric" aria-label="Quantidade de '+esc(p.name)+'" '+(available?'':'disabled')+'></div>';
        }).join('')+'</section>';
    }).join('')+'</div>'+
    '<label class="field"><span>Observação (opcional)</span><input type="text" name="note" maxlength="250" placeholder="Ex.: caixas para o evento"></label>';
}
export function collectEventBatch(form){
  const result=[];
  for(const el of form.querySelectorAll('[data-batch-id]')){
    const raw=String(el.value||'').trim();
    if(raw===''||raw==='0')continue;
    const qty=Number(raw),max=Number(el.max);
    if(!Number.isInteger(qty)||qty<0||qty>max)
      throw new Error('Quantidade inválida ou maior que o saldo disponível.');
    if(qty>0)result.push({product_id:el.dataset.batchId,quantity:qty});
  }
  if(!result.length)throw new Error('Informe a quantidade de pelo menos um produto.');
  return result;
}
export function eventReturnPage(event,items,models,balances,photoButton){
  const eligible=items.filter(p=>balances.some(b=>b.product_id===p.id&&b.event_id===event.id&&b.quantity>0));
  const groups=groupInventory(eligible,models);
  const count=balances.filter(b=>b.event_id===event.id).reduce((a,b)=>a+b.quantity,0);
  return '<div class="crumb"><button type="button" class="plain" data-action="event-return-back">← Voltar ao evento</button></div>'+
    '<header class="pagehead"><div><h1>Devolução rápida</h1><p>'+esc(event.name)+
    ' · '+count+' unidade(s) pendente(s) de retorno ou venda</p></div></header>'+
    '<div class="return-workflow-guide"><strong>Como devolver</strong><span>1. Leia o EAN ou busque o produto. 2. Informe quantos voltaram. 3. Confirme. O estoque da loja aumenta imediatamente.</span></div>'+
    '<section class="return-search-box"><input id="event-return-search" type="search" class="search" placeholder="EAN, SKU, tamanho ou nome..." autocomplete="off" aria-label="Buscar produto na devolução">'+
    '<button class="button primary" type="button" data-action="event-return-scan">📷 Ler EAN</button></section>'+
    '<p class="muted" data-return-count>'+eligible.length+' variação(ões) ainda no evento.</p>'+
    '<div class="return-cards">'+groups.map(g=>'<article class="return-product-card" data-return-group data-search="'+
      esc([g.title,...g.products.map(p=>[p.name,p.ean,p.sku,p.apparel_color,p.apparel_size].join(' '))].join(' ').toLowerCase())+'">'+
      '<div class="return-product-head">'+photoButton(g.main)+'<strong>'+esc(g.title)+'</strong></div>'+
      g.products.map(p=>{
        const qty=balances.find(b=>b.product_id===p.id&&b.event_id===event.id)?.quantity||0;
        return '<form data-form="event-return-quick" class="return-variant" data-id="'+esc(p.id)+'" data-search="'+
          esc([p.name,p.ean,p.sku,p.apparel_size,p.apparel_color].join(' ').toLowerCase())+'">'+
          '<div class="return-variant-info"><strong>'+esc(g.modelId?p.apparel_color+' · '+p.apparel_size:p.name)+'</strong>'+
          '<small>'+esc(p.ean||p.sku||'Sem código')+'</small>'+
          '<small>No evento: <b>'+qty+'</b></small></div>'+
          '<div class="return-variant-entry"><button class="return-all" data-action="return-all" type="button" aria-label="Preencher '+qty+' unidades para devolver">Tudo</button>'+
          '<input name="quantity" type="number" inputmode="numeric" step="1" min="1" max="'+qty+
          '" placeholder="Qtd." required aria-label="Quantidade devolvida de '+esc(p.name)+'">'+
          '<button type="submit" class="button primary">Devolver</button></div></form>';
      }).join('')+'</article>').join('')+'</div>';
}
export function filterWorkflowRows(container,query,mode){
  const q=(query||'').trim().toLocaleLowerCase('pt-BR');
  let count=0;
  for(const group of container.querySelectorAll(mode==='return'?'[data-return-group]':'[data-batch-group]')){
    const match=String(group.dataset.search||'').toLocaleLowerCase('pt-BR').includes(q);
    group.hidden=!match;if(match)count++;
    if(mode==='return'){
      const variants=group.querySelectorAll('.return-variant');
      for(const row of variants){
        // EAN exato: não oferece devolução para outros tamanhos.
        const exact=q&&variants.length>1&&[...variants].some(v=>v.dataset.search.split(' ').includes(q)&&/^[0-9]{8,14}$/.test(q));
        row.hidden=!!(exact&&!row.dataset.search.split(' ').includes(q));
      }
    }
  }
  return count;
}
