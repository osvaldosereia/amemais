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
  const entry=kind==='entrada',groups=stockOperationResults(items,models,query,groupInventory);
  const active=destinations.filter(d=>d.active).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const total=[...cart.values()].reduce((a,x)=>a+(Number(x.quantity)||0),0);
  return '<header class="pagehead"><div><h1>'+ (entry?'Entrada de estoque':'Saída de estoque')+
    '</h1><p>'+(entry?'Receba novas remessas da fábrica ou reposições.':
      'Retire mercadorias do estoque e registre para onde foram enviadas.')+
    '</p></div><div class="actions">'+
    button(entry?'Ir para Saída':'Ir para Entrada','view','data-view="'+(entry?'saida':'entrada')+'"','small')+'</div></header>'+
    '<div class="stock-operation-layout"><section class="panel stock-operation-catalog">'+
      '<div class="stock-section-head"><h2>1. Localizar produto</h2><span>Nome, código interno ou EAN</span></div>'+
      '<div class="stock-search-controls"><input id="stock-op-search" class="search" type="search" autocomplete="off" inputmode="search" value="'+h(query||'')+'" placeholder="Busque ou leia o EAN…">'+
       button('📷 Ler EAN','stock-scan','','primary')+'</div>'+
      '<div class="stock-scan-hint">Leia o mesmo EAN novamente para adicionar mais uma unidade. Você pode alterar a quantidade antes de salvar.</div>'+
      '<div class="stock-search-results" data-stock-search-results>'+
        (query.trim()?stockOperationSearchHTML({groups,h,qtyStore}):
         '<p class="stock-search-welcome">Digite um nome, SKU ou EAN para encontrar o produto e escolher a variação.</p>')+
      '</div>'+
      (entry?'<div class="stock-register-new"><span>Produto ainda não cadastrado?</span>'+
        button('+ Cadastrar produto','stock-create-product','','primary')+'</div>':'')+
    '</section>'+
    '<section class="panel stock-operation-basket">'+
     '<div class="stock-section-head"><h2>2. '+(entry?'Itens recebidos':'Itens retirados')+'</h2>'+
       '<span data-stock-basket-count>'+cart.size+' tipo(s) · '+total+' un.</span></div>'+
     '<div class="stock-cart-list" data-stock-cart>'+stockCartHTML({cart,items,models,qtyStore,groupInventory,kind,photoButton,h})+'</div>'+
     '<form data-form="stock-operation" class="stock-operation-final" novalidate>'+
      (!entry?'<label class="stock-destination-field"><span>Destino da saída *</span>'+
        '<select name="destination_id" required><option value="">Selecione o destino…</option>'+
          active.map(d=>'<option value="'+h(d.id)+'" '+(d.id===selectedDestination?'selected':'')+'>'+h(d.name)+'</option>').join('')+'</select></label>'+
        '<div class="stock-destination-tools">'+button('+ Criar destino','stock-destination-new','','small')+
        button('Gerenciar destinos','stock-destinations-toggle','','small')+'</div>'+
        '<div class="stock-destination-list" data-stock-destinations hidden>'+
          (destinations.length?destinations.map(d=>'<div class="stock-destination-row">'+
            '<div><strong>'+h(d.name)+'</strong><small>'+(d.active?'Ativo':'Inativo')+
             (d.description?' · '+h(d.description):'')+'</small></div>'+
            (d.active?button('Editar','stock-destination-edit','data-id="'+h(d.id)+'"','small')+
                 button('Desativar','stock-destination-disable','data-id="'+h(d.id)+'"','small danger'):'')+
            '</div>').join(''):'<p>Nenhum destino cadastrado.</p>')+'</div>':'')+
       '<label class="stock-note-field"><span>'+(entry?'Identificação da remessa (opcional)':'Observação (opcional)')+
          '</span><textarea name="note" maxlength="400" rows="2" placeholder="'+
          (entry?'Ex.: Fábrica, nota fiscal ou fornecedor':'Ex.: Quem recebeu, motivo ou referência')+'"></textarea></label>'+
       '<div class="stock-operation-summary" data-stock-summary>'+cart.size+' tipo(s) de produto · '+total+' unidade(s)</div>'+
       '<div class="stock-form-error" data-stock-error role="alert" hidden></div>'+
       '<button class="button primary stock-save-batch" type="submit" '+(!cart.size?'disabled':'')+'>'+
         (entry?'Confirmar entrada':'Confirmar saída')+'</button>'+
       '<small class="stock-operation-safety">Salvamento único e auditado. '+(entry?'Soma ao estoque da loja.':
         'Subtrai da loja; não cria venda nem transferência para evento.')+'</small>'+
     '</form></section></div>'+
     '<section class="panel stock-operation-history"><div class="stock-section-head"><h2>Últimas operações</h2><span>Registro com data e destino</span></div>'+
       '<div data-stock-operation-history>'+stockOperationHistoryHTML({batches,destinations,lines:batchLines,items})+'</div></section>';
}
