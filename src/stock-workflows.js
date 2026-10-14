// AME MAIS: consultas agrupadas, inclusão de tamanhos e logística dos eventos.
// Sem estoque paralelo: cada linha representa um produto/variação real.
const sizes=['P','M','G','GG','XGG','XXGG','EXGG','PP','Único'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bySize=(a,b)=>{
  const ai=sizes.indexOf(a.apparel_size),bi=sizes.indexOf(b.apparel_size);
  return (ai<0?100:ai)-(bi<0?100:bi)||
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
export function groupedCard(group,{h,photoButton,qtyStore,qtyEvent,button,isManager,canRegisterProducts,mode='products',eventId=null}){
  const main=group.main;
  const count=group.products.reduce((sum,p)=>sum+(mode==='event'?qtyEvent(p.id,eventId):qtyStore(p.id)),0);
  const canManage=mode==='products'&&canRegisterProducts();
  const productActions=(p)=>{
    if(mode==='event')return '';
    const extra=canManage?button('Editar','product-edit','data-id="'+h(p.id)+'"','small'):'';
    return '<div class="group-variant-actions">'+extra+
      (isManager()?button('Estoque','stock-modal','data-id="'+h(p.id)+'"','small'):'')+
      (isManager()?button('Excluir','product-delete','data-id="'+h(p.id)+'"','small danger'):'')+'</div>';
  };
  const variants=group.products.map(p=>{
    const n=mode==='event'?qtyEvent(p.id,eventId):qtyStore(p.id);
    return '<div class="group-variant-row" data-product-id="'+h(p.id)+'">'+
      '<div class="group-variant-description"><strong>'+h(group.modelId?(p.apparel_color+' · '+p.apparel_size):p.name)+'</strong>'+
      '<small>'+h(p.ean||p.sku||'Sem EAN / SKU')+'</small></div>'+
      '<span class="group-variant-stock '+(n===0?'stock-zero':'')+'">'+n+' un.</span>'+
      productActions(p)+'</div>';
  }).join('');
  return '<article class="grouped-inventory-card">'+
    '<div class="grouped-inventory-top">'+
      '<div class="grouped-inventory-photo">'+photoButton(main)+'</div>'+
      '<div class="grouped-inventory-info"><strong>'+h(group.title)+'</strong>'+
      '<small>'+h(group.modelId?'Produto com '+group.products.length+' variação(ões)':'Produto único')+'</small>'+
      '<span class="grouped-total">Total '+(mode==='event'?'no evento':'na loja')+': <b>'+count+'</b></span>'+
      (group.modelId&&canManage?button('+ Novos tamanhos','add-variants','data-id="'+h(group.modelId)+'"','small primary'):'')+
      '</div></div><div class="group-variant-list">'+variants+'</div></article>';
}
function sizeLine(size){
  return '<div class="add-size-row" data-extra-size="'+size+'" hidden>'+
    '<div class="add-size-title"><strong>'+size+'</strong><span>Nova variação</span></div>'+
    '<label>SKU <small>(automático se vazio)</small><input name="sku" maxlength="80" disabled placeholder="Gerar automaticamente"></label>'+
    '<label>EAN <small>(opcional)</small><input name="ean" inputmode="numeric" maxlength="14" disabled placeholder="8 a 14 dígitos"></label>'+
    '<label>Estoque inicial<input name="quantity" type="number" inputmode="numeric" min="0" max="1000000" step="1" value="0" disabled required></label></div>';
}
export function addSizesContent(model,variants){
  const color=variants[0]?.apparel_color||'Branco';
  const existing=new Set(variants.filter(p=>String(p.apparel_color).toLowerCase()===color.toLowerCase()).map(p=>p.apparel_size));
  return '<p class="muted">Adicione novos tamanhos ao mesmo produto. Os já cadastrados serão preservados, inclusive o histórico.</p>'+
    '<div class="formgrid"><label class="field wide"><span>Cor</span><input type="text" name="new_color" required minlength="2" maxlength="40" value="'+esc(color)+'"></label></div>'+
    '<div class="note">Escolha uma cor e marque os tamanhos que chegaram. O SKU será gerado automaticamente, se ficar vazio.</div>'+
    '<div class="add-sizes-picker">'+sizes.map(s=>'<button type="button" data-action="extra-size-toggle" data-size="'+s+
       '" class="size-chip" '+(existing.has(s)?'disabled title="Já cadastrado nessa cor"':'')+' aria-pressed="false">'+s+'</button>').join('')+'</div>'+
    '<div class="extra-size-list">'+sizes.map(sizeLine).join('')+'</div>';
}
export function updateExtraSizeButtons(form,products){
  const color=(form.querySelector('[name="new_color"]')?.value||'').trim().toLowerCase();
  for(const btn of form.querySelectorAll('[data-action="extra-size-toggle"]')){
    const taken=products.some(p=>p.apparel_size===btn.dataset.size&&String(p.apparel_color).toLowerCase()===color);
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
  const color=(form.querySelector('[name="new_color"]')?.value||'').trim();
  if(color.length<2||color.length>40)throw new Error('Informe uma cor válida.');
  const selected=[...form.querySelectorAll('[data-extra-size]')].filter(row=>!row.hidden);
  if(!selected.length)throw new Error('Selecione pelo menos um novo tamanho.');
  return selected.map(row=>{
    const take=n=>(row.querySelector('[name="'+n+'"]')?.value||'').trim();
    const size=row.dataset.extraSize,sku=take('sku')||null,ean=take('ean')||null,raw=take('quantity');
    const quantity=Number(raw);
    if(products.some(p=>p.apparel_size===size&&String(p.apparel_color).toLowerCase()===color.toLowerCase()))
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
          '<div class="return-variant-entry"><input name="quantity" type="number" inputmode="numeric" step="1" min="1" max="'+qty+
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
