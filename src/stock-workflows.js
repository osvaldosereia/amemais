// Espelho local do seletor: módulos de catálogo devem permanecer independentes de DOM/imports.
const gondolaSelectHTML=(name,locations=[],current='',opts={})=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[x]));
 const selected=String(current||'');
 const list=(locations||[]).filter(x=>x.active||x.name===selected).slice();
 if(selected&&!list.some(x=>x.name===selected))list.push({name:selected,active:false});
 list.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{numeric:true}));
 return '<label class="field"><span>'+esc(opts.label||'Gôndola')+'</span><select name="'+esc(name)+'"'+(opts.disabled?' disabled':'')+'>'+
 '<option value=""'+(!selected?' selected':'')+'>Sem gôndola definida</option>'+
 list.map(x=>'<option value="'+esc(x.name)+'"'+(x.name===selected?' selected':'')+'>'+esc(x.name)+(x.active?'':' (antiga)')+'</option>').join('')+
 '</select></label>';
};
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
export function groupedCard(group,{h,photoButton,qtyStore,qtyEvent,qtyReserved=()=>0,qtyAvailable=qtyStore,button,isManager,canRegisterProducts,canMoveStock=()=>false,canManageSku=()=>false,canQuickCount=()=>false,canDeleteWholeModel=()=>false,canDeleteProduct=()=>false,canEditProduct=null,canBalance=()=>false,canStockEntry=()=>false,canStockExit=()=>false,canShare=false,canLabel=false,expanded=false,historyForGroup=()=>[],categories=[],purchases=new Map(),mode='products',eventId=null}){
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
  const canEdit=isProducts&&(canEditProduct?canEditProduct():canRegisterProducts());
  // Atalho contextual: o editor de fotos abre diretamente sem acessar as abas de cadastro.
  const photoQuickAction=canEdit?
    '<button type="button" class="product-card-photo-quick" data-action="product-gallery-quick" data-id="'+h(group.modelId||main.id)+'" data-is-model="'+String(Boolean(group.modelId))+'" '+
    'aria-label="Editar fotos de '+h(group.title)+'" title="Editar fotos" >'+
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+
    '<rect x="3" y="3" width="15" height="15" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 15 4-4 3 3 3-3 5 5"/><path d="M20 11v8M16 15h8"/></svg></button>':'';

  const canMove=isProducts&&canMoveStock();
  const skuAccess=isProducts&&canManageSku();
  const inlineCount=isProducts&&canQuickCount();
  const manage=isProducts&&isManager();
  const canRemoveEntireModel=isProducts&&Boolean(group.modelId)&&canDeleteWholeModel();
  const quantity=p=>mode==='event'?qtyEvent(p.id,eventId):qtyStore(p.id);
  const count=active.reduce((sum,p)=>sum+quantity(p),0);
  const groupReserved=isProducts?active.reduce((sum,p)=>sum+qtyReserved(p.id),0):0;
  const groupAvailable=isProducts?active.reduce((sum,p)=>sum+qtyAvailable(p.id),0):count;
  const stockLabel=mode==='event'?'Na loja temporária':'Disponível';
  const pending=active.map(p=>({id:p.id,record:purchases.get?.(p.id)})).filter(x=>x.record?.quantity>0);
  const incomingCount=pending.reduce((n,x)=>n+Number(x.record.quantity||0),0);
  const incomingDates=pending.flatMap(x=>x.record.dates||[]).sort();
  const soonest=incomingDates[0]||null;
  const localDate=soonest?new Date(soonest+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'America/Cuiaba'}):'não informada';
  const arrivalChip=isProducts&&incomingCount>0?
    '<div class="product-purchase-arrival" role="note">📦 <strong>Encomendado: '+fmt(incomingCount)+' un.</strong>'+
    '<small>Previsão: '+h(localDate)+'</small></div>':'';

  const colors=[...new Set(active.map(p=>(p.apparel_color||'').trim()).filter(c=>c&&c!=='Única'))];
  const description=group.modelId
    ?active.length+' '+(active.length===1?'variação':'variações')
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
          (purchases.get?.(p.id)?.quantity>0?'<small class="product-variant-purchase">📦 Encomendado: '+fmt(purchases.get(p.id).quantity)+' un. · Previsão '+h(purchases.get(p.id).dates?.slice().sort()[0]||'a definir')+'</small>':'')+
          '</div></div>'+stockHtml+
        ((skuAccess||canCount)?'<div class="group-variant-actions">'+
          (canCount?button('✓ Salvar','stock-free-save','data-id="'+h(p.id)+'" hidden','small primary variant-count-save'):'')+
          (skuAccess?button('Gerenciar SKU','sku-manage','data-id="'+h(p.id)+'"','small'):'')+
          '</div>':'')+
        '</div>';
    }).join('')+'</div>';
  };
  // Um card por modelo: ações principais retráteis, balanceamento por SKU.
  const direct=(label,action,id,css='')=>button(label,action,
    'data-id="'+h(id)+'"','small '+css);
  const stockRows=active.map(p=>{
    const physical=quantity(p),reserved=qtyReserved(p.id),free=qtyAvailable(p.id);
    return '<div class="card-balance-row" data-balance-item data-product-id="'+h(p.id)+
      '" data-expected="'+physical+'" data-reserved="'+reserved+'">'+
      '<div class="card-balance-identity"><strong>'+h(p.apparel_size||'Único')+'</strong>'+
        '<span>'+h(p.apparel_color&&p.apparel_color!=='Única'?p.apparel_color:p.name)+'</span>'+
        '<small>SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</small></div>'+
      '<div class="card-balance-metrics"><div><small>Físico</small><strong>'+fmt(physical)+'</strong></div>'+
        '<div><small>Reservado</small><strong>'+fmt(reserved)+'</strong></div>'+
        '<div><small>Livre</small><strong>'+fmt(free)+'</strong></div>'+
        '<label><small>Contado</small><input type="number" data-balance-count inputmode="numeric" min="'+reserved+
         '" max="1000000" step="1" value="'+physical+'" aria-label="Quantidade física contada · '+h(p.apparel_size||p.name)+'"'+
         (!canBalance()?' disabled':'')+'></label></div>'+
        (canEdit?'<button type="button" class="button small card-balance-edit-variant" data-action="'+(group.modelId?'apparel-variant-edit':'product-edit')+'" data-id="'+h(p.id)+'">Editar EAN / gôndola</button>':'')+'</div>';
  }).join('');
  const history=historyForGroup(group)||[];
  // Consulta rápida: uma linha por tamanho, sem miniaturas, sem alteração de saldo.
  const variantOverview='<div class="product-variant-overview" role="region" aria-label="Saldos por variação de '+h(group.title)+'">'+
    '<div class="product-variant-head" aria-hidden="true">'+
      '<span>Tamanho</span><span>SKU / EAN</span><span>Físico</span>'+
      '<span>Reservado</span><span>Disponível</span><span>Ação</span></div>'+
    '<div class="product-variant-overview-list">'+group.products.map(p=>{
      const physical=p.active?quantity(p):0;
      const reserved=p.active?qtyReserved(p.id):0;
      const available=p.active?qtyAvailable(p.id):0;
      const size=group.modelId?(p.apparel_size||'Único'):'Único';
      const editAction=group.modelId?'apparel-variant-edit':'product-edit';
      return '<div class="product-variant-overview-row'+(p.active?'':' is-inactive')+'" data-variant-overview-id="'+h(p.id)+'">'+
        '<div class="product-variant-size"><strong>'+h(size)+'</strong>'+
          (!p.active?'<small>Inativo</small>':'')+'</div>'+
        '<div class="product-variant-identifiers"><small>SKU: '+h(p.sku||'—')+'</small>'+
          '<small>EAN: '+h(p.ean||'—')+'</small></div>'+
        '<div class="product-variant-figure" data-label="Físico"><span class="product-variant-metric-label">Físico</span><strong>'+fmt(physical)+'</strong></div>'+
        '<div class="product-variant-figure" data-label="Reservado"><span class="product-variant-metric-label">Reservado</span><strong>'+fmt(reserved)+'</strong></div>'+
        '<div class="product-variant-figure is-available" data-label="Disponível"><span class="product-variant-metric-label">Disponível</span><strong>'+fmt(available)+'</strong></div>'+
        '<div class="product-variant-row-action">'+
          (canEdit?'<button type="button" class="product-variant-edit" data-action="'+editAction+'" data-id="'+h(p.id)+'" aria-label="Editar variação '+h(size)+'">Editar</button>':'')+
        '</div></div>';
    }).join('')+'</div>'+
    (group.modelId&&canEdit?'<button type="button" class="product-variant-add" data-action="add-variants" data-id="'+h(group.modelId)+'">+ Adicionar variação</button>':'')+
    '</div>';
  const stockTabs='<div class="card-workspace-tabs" role="tablist" aria-label="Estoque do produto">'+
   '<button type="button" data-action="product-stock-tab" data-tab="balanco" role="tab" aria-selected="true">Balanço rápido</button>'+
   '<button type="button" data-action="product-stock-tab" data-tab="movimentar" role="tab" aria-selected="false">Movimentar</button>'+
   '<button type="button" data-action="product-stock-tab" data-tab="historico" role="tab" aria-selected="false">Histórico</button></div>';
  const stockWorkspace=isProducts?
   '<details class="grouped-variants-mobile card-workspace product-variants-details" data-product-details'+(expanded?' open':'')+'>'+
     '<summary>Variações ('+active.length+')</summary>'+variantOverview+
     '<details class="product-advanced-stock"><summary>Operações de estoque: balanço, movimentação e histórico</summary>'+stockTabs+
     '<section data-stock-panel="balanco"><p class="card-workspace-help">Conte as quantidades físicas de todas as variações. As reservas não podem ser reduzidas.</p>'+
        '<div class="card-balance-search"><input type="search" data-balance-scan-input placeholder="Bipe ou digite EAN/SKU e pressione Enter" aria-label="Localizar variação pelo código" autocomplete="off">'+
        '<button type="button" class="button" data-action="product-balance-scan">Ler pela câmera</button></div>'+
        '<div class="card-balance-list">'+(stockRows||'<p>Nenhuma variação ativa.</p>')+'</div>'+
        (canBalance()?'<label class="card-balance-note" hidden>Motivo da divergência <textarea data-balance-note maxlength="250" rows="2" placeholder="Informe a causa da diferença identificada"></textarea></label>'+
        '<div class="card-balance-footer"><span data-balance-status>Nenhuma diferença identificada</span>'+
        '<button type="button" class="button primary" data-action="product-balance-save">Salvar balanço</button></div>':
        '<p class="card-workspace-help">Seu perfil permite somente consultar os saldos.</p>')+
     '</section>'+
     '<section data-stock-panel="movimentar" hidden><p class="card-workspace-help">Selecione a variação e o tipo de movimentação.</p>'+
     '<div class="card-stock-move-list">'+active.map(p=>'<div class="card-stock-move-row"><strong>'+h(p.apparel_size||p.name)+
       ' · '+h(p.apparel_color||'')+'</strong><span>'+fmt(quantity(p))+' un. físicas</span>'+
       (skuAccess?'<div class="card-stock-move-buttons">'+
         (canStockEntry()?'<button type="button" data-action="product-stock-mode" data-id="'+h(p.id)+'" data-mode="entrada">Entrada</button>':'')+
         (canStockExit()?'<button type="button" data-action="product-stock-mode" data-id="'+h(p.id)+'" data-mode="saida">Saída excepcional</button>':'')+
         (canBalance()?'<button type="button" data-action="product-stock-mode" data-id="'+h(p.id)+'" data-mode="contagem">Conferir SKU</button>':'')+
         '</div>':'')+'</div>').join('')+'</div></section>'+
     '<section data-stock-panel="historico" hidden><p class="card-workspace-help">Últimos movimentos registrados das variações.</p>'+
        (history.length?'<ul class="card-stock-history">'+history.slice(0,10).map(m=>'<li><strong>'+h(m.label||m.action||'Movimento')+
         '</strong><span>'+h(m.action||'')+' · '+h(String(m.quantity??0))+' un.</span>'+
         '<small>'+h(m.created_at?new Date(m.created_at).toLocaleDateString('pt-BR'):'')+'</small></li>').join('')+'</ul>':
         '<p class="card-workspace-help">Nenhuma movimentação recente na lista carregada.</p>')+'</section>'+
     '</details></details>':'<details class="grouped-variants-mobile" data-product-details'+(expanded?' open':'')+'>'+
      '<summary>Estoque por variação</summary>'+modelRows()+'</details>';
  const model=group.model;
  const basicName=model?.name||main.name;
  const basicTags=model?.tags||main.tags||[];
  const edition=isProducts&&canEdit?
   '<details class="product-card-editor card-workspace" data-product-editor>'+
    '<summary>Editar cadastro do produto</summary>'+
    '<div class="card-workspace-tabs" role="tablist" aria-label="Editar produto">'+
      '<button type="button" data-action="product-editor-tab" data-tab="geral" role="tab" aria-selected="true">Geral</button>'+
      '<button type="button" data-action="product-editor-tab" data-tab="variacoes" role="tab" aria-selected="false">Variações</button>'+
      '<button type="button" data-action="product-editor-tab" data-tab="fotos" role="tab" aria-selected="false">Fotos</button></div>'+
    '<section data-editor-panel="geral"><form data-form="product-card-basic" data-id="'+h(model?.id||main.id)+'" data-is-model="'+Boolean(group.modelId)+'">'+
      '<details class="card-editor-accordion" open><summary>Dados gerais</summary>'+
        '<label>Nome do produto<input name="name" maxlength="180" required value="'+h(basicName)+'"></label>'+
        '<label>Tags (separadas por vírgula)<input name="tags" maxlength="500" value="'+h(basicTags.join(', '))+'"></label>'+
        '<label>Categoria<select name="category_id">'+(categories.length?categories.map(cat=>'<option value="'+h(cat.id)+'"'+(cat.id===(model?.category_id||main.category_id)?' selected':'')+'>'+h(cat.name)+'</option>').join(''):'<option value="'+h(model?.category_id||main.category_id||'')+'">Categoria atual</option>')+'</select></label>'+
        '</details>'+
      '<details class="card-editor-accordion"><summary>Localização e códigos</summary>'+
         '<p>SKU, EAN, gôndola e prateleira são individuais para cada variação. Use a aba Variações para editá-los.</p></details>'+
      '<div class="card-editor-actions"><button type="submit" class="button primary">Salvar dados gerais</button></div></form></section>'+
    '<section data-editor-panel="variacoes" hidden><div class="card-editor-variation-list">'+group.products.map(p=>
      '<div class="card-editor-variation"><div><strong>'+h(p.apparel_size||'Único')+' · '+h(p.apparel_color||'')+'</strong>'+
      '<small>SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</small>'+
      '<small>'+h([p.gondola?'Gôndola '+p.gondola:'',p.prateleira?'Prateleira '+p.prateleira:''].filter(Boolean).join(' · ')||'Localização não informada')+'</small></div>'+
      direct('Editar variação',group.modelId?'apparel-variant-edit':'product-edit',p.id)+'</div>').join('')+'</div>'+
      (group.modelId?direct('+ Adicionar variação','add-variants',group.modelId):'')+
      (canRemoveEntireModel?direct('Excluir produto completo','product-model-delete',group.modelId,'danger'):'')+
      (!group.modelId&&canDeleteProduct()?direct('Excluir produto','product-delete',main.id,'danger'):'')+
      '<details class="card-editor-accordion card-admin-tools"><summary>Administração avançada</summary>'+
        '<p>Excluir pode afetar reservas e pedidos pendentes. O histórico concluído é preservado.</p>'+
        '<p>Exclusão integral disponível acima para perfis autorizados.</p>'+
      '</details></section>'+
    '<section data-editor-panel="fotos" hidden><p class="card-workspace-help">Edite a galeria de fotos do produto.</p>'+
      (group.modelId?direct('Gerenciar fotos','apparel-photo',group.modelId):
        direct('Gerenciar fotos','product-edit',main.id))+'</section>'+
   '</details>':'';
  const primaryStock=isProducts?
    '<button type="button" class="button product-card-action-primary product-card-action-stock" data-action="product-card-sizes" '+
      'aria-expanded="'+String(Boolean(expanded))+'">Ver variações <span aria-hidden="true">⌄</span></button>':'';
  const primaryEdit=canEdit?
    '<button type="button" class="button product-card-action-primary" data-action="product-card-edit-toggle" aria-expanded="false">'+
      'Editar produto <span aria-hidden="true">⌄</span></button>':'';
  // Ações essenciais na superfície do card; utilitários ficam acessíveis em detalhes.
  // Estoques físico, reservado, disponível, foto e gôndola permanecem sempre visíveis.
  const hasUtilities=isProducts&&(canLabel||canShare||(group.modelId&&canEdit)||
    canRemoveEntireModel||(!group.modelId&&canDeleteProduct()));
  const actions=isProducts?
    '<div class="grouped-inventory-actions product-card-actions-v5" aria-label="Ações de '+h(group.title)+'">'+
      '<div class="product-card-action-primary-row">'+primaryStock+primaryEdit+'</div>'+
      (hasUtilities?'<details class="product-card-utilities">'+
        '<summary>Mais opções <span aria-hidden="true">⌄</span></summary>'+
        '<div class="product-card-utilities-content">'+
          '<div class="product-card-action-secondary-row">'+
            (canLabel?direct('Etiqueta 57 mm','shelf-label-open',main.id,'product-card-action-secondary'):'')+
            (canShare?direct('Compartilhar','share-product',main.id,'product-card-action-secondary'):'')+
            (group.modelId&&canEdit?direct('+ Variação','add-variants',group.modelId,'product-card-action-secondary'):'')+
          '</div>'+
          (canRemoveEntireModel||(!group.modelId&&canDeleteProduct())?
           '<div class="product-card-action-danger-row">'+
             (canRemoveEntireModel?direct('Excluir produto e todas as variações','product-model-delete',group.modelId,'danger product-card-delete-whole'):'')+
             (!group.modelId&&canDeleteProduct()?direct('Excluir produto','product-delete',main.id,'danger product-card-delete-whole'):'')+
           '</div>':'')+'</div></details>':'')+
    '</div>':'';

  return '<article class="grouped-inventory-card product-card-v3" data-product-card="'+h(group.key)+'">'+
    '<div class="grouped-inventory-top">'+
      '<div class="grouped-inventory-photo">'+photo+photoQuickAction+'</div>'+
      '<div class="grouped-inventory-info">'+
        '<small class="product-card-description">'+h(description)+'</small>'+
        '<strong class="product-card-name">'+h(group.title)+'</strong>'+
        (sizeCount===1?'<small class="product-card-codes">SKU: '+h(main.sku||'—')+' · EAN: '+h(main.ean||'—')+'</small>':'')+
        '<div class="product-stock-total '+(count===0?'product-stock-empty':'')+'">'+
          '<small>'+stockLabel+'</small><span><b>'+fmt(isProducts?groupAvailable:count)+'</b> un.</span></div>'+
        '<div class="product-card-location'+(locationMissing?' is-unknown':'')+'" aria-label="Localização do produto">'+
           '<span class="product-location-icon" aria-hidden="true">⌖</span>'+
           '<strong>'+h(location)+'</strong></div>'+
        arrivalChip+
      '</div>'+
      (isProducts?'<div class="stock-total-breakdown">'+
          '<div class="stock-total-metric reserved"><small>Físico</small><strong>'+fmt(count)+'</strong><span>un.</span></div>'+
          '<div class="stock-total-metric available"><small>Reservado</small><strong>'+fmt(groupReserved)+'</strong><span>un.</span></div>'+
        '</div>':'')+
    '</div>'+

    (isProducts?actions:'')+
    stockWorkspace+edition+
    '</article>';
}
function sizeLine(size,gondolas=[]){
  return '<div class="add-size-row" data-extra-size="'+esc(size)+'" hidden>'+
    '<div class="add-size-title"><strong>'+size+'</strong><span>Nova variação</span></div>'+
    '<label>SKU <small>(automático se vazio)</small><input name="sku" maxlength="80" disabled placeholder="Gerar automaticamente"></label>'+
    '<label>EAN <small>(opcional)</small><input name="ean" inputmode="numeric" maxlength="14" disabled placeholder="8 a 14 dígitos"></label>'+
    gondolaSelectHTML('gondola',gondolas,'',{label:'Gôndola da nova variação',disabled:true})+
    '<label>Prateleira<input name="prateleira" maxlength="40" disabled placeholder="Ex.: B"></label>'+
    '<label>Estoque inicial<input name="quantity" type="number" inputmode="numeric" min="0" max="1000000" step="1" value="0" disabled required></label></div>';
}
export function addSizesContent(model,variants,choices=[],gondolas=[]){
  const color=variants.find(p=>p.active)?.apparel_color||'Única';
  const existing=new Set(variants.filter(p=>p.active&&
    String(p.apparel_color||'').toLocaleLowerCase('pt-BR')===color.toLocaleLowerCase('pt-BR'))
    .map(p=>String(p.apparel_size||'').toLocaleLowerCase('pt-BR')));
  const available=choices.filter(size=>!existing.has(String(size).toLocaleLowerCase('pt-BR')));
  return '<p class="muted">Adicione novas variações permitidas pela categoria. As existentes e seu histórico serão preservados.</p>'+
   '<input type="hidden" name="new_color" value="'+esc(color)+'">'+
   (available.length?
    '<div class="note">Selecione as variações a cadastrar. SKU e EAN podem ser informados individualmente.</div>'+
    '<div class="add-sizes-picker">'+choices.map(size=>existing.has(String(size).toLocaleLowerCase('pt-BR'))?
      '<span class="size-chip size-chip-existing" title="Variação já cadastrada" aria-label="'+esc(size)+' já existe">'+esc(size)+' ✓</span>':
      '<button type="button" data-action="extra-size-toggle" data-size="'+esc(size)+
      '" class="size-chip" aria-pressed="false">'+esc(size)+'</button>').join('')+'</div>'+
    '<div class="extra-size-list">'+available.map(size=>sizeLine(size,gondolas)).join('')+'</div>':
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
        row.hidden=true;row.querySelectorAll('input,select').forEach(el=>el.disabled=true);
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
  row.querySelectorAll('input,select').forEach(el=>el.disabled=!enable);
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
    return {size,color,sku,ean,gondola:take('gondola'),prateleira:take('prateleira'),quantity};
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
