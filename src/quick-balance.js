// Balanço rápido agrupado: uma ficha por produto, cada tamanho com sua contagem.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function quickBalanceCard(group,{photoButton,qtyStore,h}){
  const variants=group.products,main=group.main;
  const total=variants.reduce((n,p)=>n+qtyStore(p.id),0);
  const q=[group.title,...variants.flatMap(p=>[p.name,p.sku,p.ean,p.apparel_color,p.apparel_size,p.gondola,p.prateleira])].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
  return '<form class="quick-group-card" data-form="quick-group-count" data-quick-group="'+esc(group.key)+'" data-search="'+esc(q)+'">'+
    '<div class="quick-group-heading">'+
      '<div class="quick-group-photo">'+photoButton(main)+'</div>'+
      '<div class="quick-group-title"><strong>'+h(group.title)+'</strong>'+
        '<small>'+variants.length+' variação(ões) · Contagem da loja</small>'+
        '<span class="quick-group-total">No sistema: <b data-quick-total>'+total+'</b> un.</span>'+
        '<small>Informe apenas os tamanhos que conferiu.</small></div>'+
    '</div>'+
    '<div class="quick-group-variants" role="group" aria-label="Contagem por tamanho">'+
      variants.map(p=>{
        const qty=qtyStore(p.id);
        const name=group.modelId?[p.apparel_color,p.apparel_size].filter(Boolean).join(' · '):p.name;
        return '<div class="quick-group-variant" data-quick-row="'+h(p.id)+'" data-ean="'+h(p.ean||'')+'">'+
          '<div class="quick-group-variant-info"><strong>'+h(name)+'</strong>'+
          '<small>SKU: '+h(p.sku||'—')+' · EAN: '+h(p.ean||'—')+'</small>'+
          '<span class="quick-group-expected">Sistema: <b data-quick-current>'+qty+'</b> un.</span></div>'+
          '<div class="quick-group-input">'+
            '<label><span>Contado</span><input type="number" data-quick-count inputmode="numeric" min="0" max="1000000" step="1" '+
              'placeholder="Qtd." autocomplete="off" aria-label="Quantidade contada de '+h(name)+'"></label>'+
            '<input type="hidden" data-quick-expected value="'+qty+'">'+
            '<button type="button" class="button quick-save-one" data-action="quick-save-one" data-id="'+h(p.id)+'" disabled>Salvar</button>'+
          '</div></div>';
      }).join('')+'</div>'+
    '<div class="quick-group-footer"><span class="quick-group-status" data-quick-status role="status">Nenhum tamanho preenchido</span>'+
      '<button type="submit" class="button primary quick-save-group" data-quick-submit disabled>Salvar contagens do card</button></div>'+
    '</form>';
}
export function collectQuickCounts(card,onlyId=null){
  const selected=[];
  for(const row of card.querySelectorAll('[data-quick-row]')){
    const id=row.dataset.quickRow;
    if(onlyId&&id!==onlyId)continue;
    const input=row.querySelector('[data-quick-count]');
    const text=(input?.value||'').trim();
    if(!text)continue; // Contagem não informada NÃO equivale a zero.
    const expected=Number(row.querySelector('[data-quick-expected]')?.value),counted=Number(text);
    if(!/^[0-9]{1,7}$/.test(text)||!Number.isInteger(expected)||expected<0||
       !Number.isInteger(counted)||counted<0||counted>1000000)
      throw new Error('Informe uma quantidade válida (0 a 1.000.000).');
    selected.push({product_id:id,expected,counted});
  }
  if(!selected.length)throw new Error('Preencha a contagem de pelo menos um tamanho.');
  return selected;
}
export function updateQuickCountButtons(card){
  let ready=0;
  for(const row of card.querySelectorAll('[data-quick-row]')){
    const value=row.querySelector('[data-quick-count]')?.value?.trim()||'';
    const valid=/^[0-9]{1,7}$/.test(value)&&Number(value)<=1000000;
    row.querySelector('[data-action="quick-save-one"]').disabled=!valid;
    if(valid)ready++;
  }
  const submit=card.querySelector('[data-quick-submit]');
  if(submit)submit.disabled=ready===0;
  const status=card.querySelector('[data-quick-status]');
  if(status)status.textContent=ready?ready+' tamanho(s) pronto(s) para salvar':'Nenhum tamanho preenchido';
  return ready;
}
export function filterQuickCountCards(container,query){
  const q=(query||'').trim().toLocaleLowerCase('pt-BR');
  let matches=0;
  for(const card of container.querySelectorAll('[data-quick-group]')){
    const visible=!q||card.dataset.search.toLocaleLowerCase('pt-BR').includes(q);
    card.hidden=!visible;
    if(visible)matches++;
    for(const row of card.querySelectorAll('[data-quick-row]')){
      row.classList.toggle('quick-ean-match',!!q&&row.dataset.ean===q);
    }
  }
  const empty=container.querySelector('[data-quick-empty]');
  if(empty)empty.hidden=matches>0;
  return matches;
}
