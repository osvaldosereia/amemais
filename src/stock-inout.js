// AME MAIS | Entrada / Saída de estoque físico, independente de Eventos e Pedidos.
// Todo item escolhido representa uma variação real de public.products.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asText=p=>[p.name,p.sku,p.ean,p.apparel_color,p.apparel_size].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
export const opSizes=['PP','P','M','G','GG','XGG','XXGG','EXGG','Único'];
export function stockOperationResults(products,models,query,groupInventory){
  const q=(query||'').trim().toLocaleLowerCase('pt-BR');
  if(!q)return [];
  const exact=products.filter(p=>p.active&&(p.ean===query.trim()||String(p.sku||'').toLocaleLowerCase('pt-BR')===q));
  const matches=exact.length?exact:products.filter(p=>p.active&&asText(p).includes(q));
  // Navegar por modelos inteiros ajuda a escolher o tamanho correto.
  const keys=new Set(matches.map(p=>p.apparel_model_id?'m:'+p.apparel_model_id:'p:'+p.id));
  const grouped=groupInventory(products.filter(p=>p.active&&keys.has(p.apparel_model_id?'m:'+p.apparel_model_id:'p:'+p.id)),models);
  return grouped.slice(0,16);
}
export function stockOperationSearchHTML({groups,h=esc,qtyStore}){
  if(!groups.length)return '<p class="stock-no-results">Produto não localizado neste cadastro ativo.</p>';
  return groups.map(group=>
    '<section class="stock-search-group"><strong>'+h(group.title)+'</strong>'+
    group.products.map(p=>'<button type="button" class="stock-pick" data-action="stock-pick" data-id="'+h(p.id)+'">'+
      '<span class="stock-pick-name">'+h(group.modelId?[p.apparel_color,p.apparel_size].filter(Boolean).join(' · '):p.name)+
        '<small>SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</small></span>'+
      '<span class="stock-pick-quantity">'+qtyStore(p.id)+' un.</span>'+
      '<span aria-hidden="true" class="stock-pick-add">+ Adicionar</span></button>').join('')+
    '</section>').join('');
}
export function stockCartHTML({cart,items,models,qtyStore,groupInventory,kind,photoButton,h=esc}){
  const grouped=groupInventory(items.filter(p=>p.active&&cart.has(p.id)),models);
  if(!grouped.length)return '<div class="stock-cart-empty">Nenhum item adicionado. Busque ou leia o EAN para começar.</div>';
  const type=kind==='entrada'?'Entrada':'Saída';
  return grouped.map(group=>'<article class="stock-cart-card">'+
    '<div class="stock-cart-header"><div class="stock-cart-photo">'+photoButton(group.main)+'</div>'+
      '<div class="stock-cart-title"><strong>'+h(group.title)+'</strong>'+
        '<small>'+group.products.length+' variação(ões) selecionada(s)</small></div></div>'+
    '<div class="stock-cart-variants">'+group.products.map(p=>{
      const line=cart.get(p.id),qty=Number(line.quantity)||0,available=qtyStore(p.id);
      const after=available+(kind==='entrada'?qty:-qty);
      return '<div class="stock-cart-line" data-stock-line="'+h(p.id)+'">'+
        '<div class="stock-line-meta"><strong>'+h(group.modelId?[p.apparel_color,p.apparel_size].filter(Boolean).join(' · '):p.name)+'</strong>'+
        '<small>EAN '+h(p.ean||'—')+' · SKU '+h(p.sku||'—')+'</small>'+
        '<small>Atual: <b>'+available+'</b> · Após '+type.toLowerCase()+': <b data-stock-projected>'+after+'</b> un.</small></div>'+
        '<div class="stock-line-controls">'+
          '<button type="button" data-action="stock-minus" data-id="'+h(p.id)+'" aria-label="Diminuir uma unidade">−</button>'+
          '<input type="number" min="1" max="1000000" step="1" inputmode="numeric" data-stock-qty data-id="'+h(p.id)+'" aria-label="Quantidade de '+h(p.name)+'" value="'+qty+'">'+
          '<button type="button" data-action="stock-plus" data-id="'+h(p.id)+'" aria-label="Aumentar uma unidade">+</button>'+
          '<button type="button" class="stock-remove" data-action="stock-remove" data-id="'+h(p.id)+'" aria-label="Retirar item da lista">✕</button>'+
        '</div></div>';
    }).join('')+'</div></article>').join('');
}
export function stockOperationHistoryHTML({batches,destinations,lines=[],items=[]}){
  if(!batches.length)return '<p class="stock-history-empty">Nenhuma operação em lote registrada ainda.</p>';
  const locations=new Map(destinations.map(x=>[x.id,x.name]));
  const products=new Map(items.map(x=>[x.id,x]));
  return batches.slice(0,12).map(b=>{
    const when=new Date(b.created_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
    const entries=lines.filter(x=>x.operation_batch_id===b.id);
    const total=entries.reduce((sum,x)=>sum+x.quantity,0);
    const prefix=b.operation==='entrada'?'Entrada':'Saída';
    return '<details class="stock-history-row"><summary><span class="stock-history-type '+
      (b.operation==='entrada'?'is-entry':'is-exit')+'">'+prefix+'</span>'+
      '<span class="stock-history-description"><strong>'+
      esc(b.operation==='saida'?locations.get(b.destination_id)||'Destino arquivado':'Recebimento')+
      '</strong><small>'+esc(when)+(b.note?' · '+esc(b.note):'')+'</small>'+
      (entries.length?'<small>'+entries.length+' variação(ões) · '+total+' unidade(s)</small>':'')+
      '</span><span class="stock-history-arrow" aria-hidden="true">▾</span></summary>'+
      (entries.length?'<div class="stock-history-details">'+entries.map(line=>{
        const product=products.get(line.product_id);
        return '<div><span>'+esc(product?.name||'Produto do histórico')+
          '<small>SKU '+esc(product?.sku||'—')+'</small></span>'+
          '<strong>'+line.quantity+' un.</strong></div>';
      }).join('')+'</div>':'<p class="stock-history-empty">Os itens desta operação não estão nesta consulta recente.</p>')+
      '</details>';
  }).join('');
}
export function operationCartLines(cart,products,qtyStore,kind){
  const byId=new Map(products.map(p=>[p.id,p])),arr=[];
  for(const [id,line] of cart){
    const p=byId.get(id),quantity=Number(line.quantity);
    if(!p?.active)throw Error('Há produtos excluídos na lista. Remova-os antes de salvar.');
    if(!Number.isInteger(quantity)||quantity<1||quantity>1000000)
      throw Error('Informe quantidade entre 1 e 1.000.000 para cada item.');
    const current=qtyStore(id);
    if(kind==='saida'&&quantity>current)throw Error('Estoque insuficiente para '+p.name+'. Disponível: '+current+'.');
    arr.push({product_id:id,quantity,expected:line.expected});
  }
  if(!arr.length)throw Error('Adicione pelo menos um produto.');
  if(arr.length>100)throw Error('Limite de 100 variações por operação.');
  return arr;
}
export function stockOperationPage({kind,query,cart,items,models,destinations,batches,batchLines=[],selectedDestination='',qtyStore,groupInventory,photoButton,h=esc,button}){
 const entry=kind==='entrada';
 const groups=stockOperationResults(items,models,query,groupInventory);
 const active=destinations.filter(d=>d.active).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const total=[...cart.values()].reduce((n,x)=>n+(Number(x.quantity)||0),0);
 const destination=entry?'':'<section class="stock-step stock-destination-first">'+
   '<div class="stock-compact-heading"><span class="stock-step-number">1</span><div><strong>Para onde vai?</strong><small>Escolha o destino antes de separar os produtos</small></div></div>'+
   '<div class="stock-destination-inline"><label class="stock-destination-field"><span>Destino da saída *</span>'+
   '<select name="destination_id" required><option value="">Selecione um destino…</option>'+
    active.map(d=>'<option value="'+h(d.id)+'" '+(d.id===selectedDestination?'selected':'')+'>'+h(d.name)+'</option>').join('')+
   '</select></label>'+button('+ Novo destino','stock-destination-new','','small')+'</div>'+
   '<details class="stock-destination-management"><summary>Gerenciar destinos</summary>'+
   '<div class="stock-destination-list">'+
   (destinations.length?destinations.map(d=>'<div class="stock-destination-row">'+
     '<div><strong>'+h(d.name)+'</strong><small>'+(d.active?'Ativo':'Inativo')+
       (d.description?' · '+h(d.description):'')+'</small></div>'+
     (d.active?button('Editar','stock-destination-edit','data-id="'+h(d.id)+'"','small')+
       button('Desativar','stock-destination-disable','data-id="'+h(d.id)+'"','small danger'):'')+
   '</div>').join(''):'<p>Nenhum destino cadastrado.</p>')+'</div></details></section>';
 const rows=stockCartHTML({cart,items,models,qtyStore,groupInventory,kind,photoButton,h});
 const search=query.trim()?stockOperationSearchHTML({groups,h,qtyStore}):
    '<p class="stock-search-welcome">Pesquise pelo nome, SKU ou leia um código EAN.</p>';
 const stepSearch=entry?'1':'2',stepCart=entry?'2':'3';
 return '<div class="stock-op-v2 '+(entry?'stock-entry':'stock-exit')+'">'+
  '<header class="stock-op-heading"><div><h1>'+(entry?'Entrada de estoque':'Saída de estoque')+'</h1>'+
  '<p>'+(entry?'Receber produtos e acrescentar quantidades à loja.':'Retirar produtos com registro do destino.')+'</p></div>'+
  '<div class="stock-op-tabs" role="group" aria-label="Tipo de movimentação">'+
   '<button type="button" data-action="view" data-view="entrada" class="'+(entry?'is-active':'')+'"'+(entry?' aria-current="page"':'')+'>↓ Entrada</button>'+
   '<button type="button" data-action="view" data-view="saida" class="'+(!entry?'is-active':'')+'"'+(!entry?' aria-current="page"':'')+'>↑ Saída</button>'+
  '</div></header>'+
  '<form data-form="stock-operation" id="stock-operation-form" class="stock-operation-layout" novalidate>'+
   destination+
   '<section class="panel stock-operation-catalog stock-step">'+
     '<div class="stock-compact-heading"><span class="stock-step-number">'+stepSearch+'</span>'+
       '<div><strong>Buscar e adicionar</strong><small>Nome, EAN ou código interno</small></div></div>'+
     '<div class="stock-search-controls"><input id="stock-op-search" class="search" type="search" autocomplete="off" inputmode="search" value="'+h(query||'')+'" placeholder="Buscar produto ou EAN…" aria-label="Buscar produto">'+
     '<button type="button" class="stock-scan-button" data-action="stock-scan" aria-label="Ler código EAN" title="Ler EAN">▣ <span>Ler EAN</span></button></div>'+
     '<div class="stock-search-results" data-stock-search-results>'+search+'</div>'+
     (entry?'<div class="stock-register-new"><span>Não encontrou?</span>'+
       button('+ Cadastrar produto','stock-create-product','','small')+'</div>':'')+
   '</section>'+
   '<section class="panel stock-operation-basket stock-step">'+
     '<div class="stock-compact-heading"><span class="stock-step-number">'+stepCart+'</span>'+
      '<div><strong>'+(entry?'Itens para entrada':'Itens para saída')+'</strong>'+
      '<small data-stock-basket-count>'+cart.size+' variação(ões) · '+total+' un.</small></div>'+
      '<button type="button" class="stock-jump-search" data-action="stock-focus-search">+ Produto</button>'+
     '</div>'+
     '<div class="stock-cart-list" data-stock-cart>'+rows+'</div>'+
     '<div class="stock-operation-final">'+
      '<details class="stock-note-expand"><summary>'+(entry?'Remessa / fornecedor (opcional)':'Observação (opcional)')+'</summary>'+
        '<label class="stock-note-field"><span>Detalhes para o histórico</span>'+
        '<textarea name="note" maxlength="400" rows="2" placeholder="'+(entry?'Ex.: Fábrica, NF ou fornecedor':'Ex.: Motivo, quem recebeu')+'"></textarea></label></details>'+
      '<div class="stock-form-error" data-stock-error role="alert" hidden></div>'+
     '</div>'+
   '</section>'+
  '</form>'+
  '<div class="stock-confirm-dock"><div class="stock-confirm-summary"><strong data-stock-summary>'+
    cart.size+' variação(ões) · '+total+' un.</strong>'+
    (!entry?'<small data-stock-destination-preview>'+h(active.find(d=>d.id===selectedDestination)?.name||'Escolha um destino')+'</small>':
      '<small>Adicionar ao estoque</small>')+
    '</div><button class="button primary stock-save-batch" form="stock-operation-form" type="submit"'+
    (!cart.size||(!entry&&!active.some(d=>d.id===selectedDestination))?' disabled':'')+'>'+
    (entry?'Confirmar entrada':'Confirmar saída')+'</button></div>'+
  '<section class="panel stock-operation-history"><div class="stock-section-head"><h2>Histórico recente</h2><span>Consulte os detalhes</span></div>'+
    '<div data-stock-operation-history>'+stockOperationHistoryHTML({batches,destinations,lines:batchLines,items})+'</div></section>'+
  '</div>';
}
