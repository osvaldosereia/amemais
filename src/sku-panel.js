// Painel único do SKU: os saldos são de leitura; operações só via RPCs auditadas.
export const skuPanelModes=[
  {key:'entrada',label:'Entrada',icon:'↓',permission:'stock.entry'},
  {key:'saida',label:'Saída',icon:'↑',permission:'stock.exit'},
  {key:'contagem',label:'Conferir',icon:'✓',permission:'stock.balance'},
  {key:'edicao',label:'Editar',icon:'✎',permission:'products.edit'}
];
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x||0).toLocaleString('pt-BR');
export function renderSkuPanel({item,model,physical,reserved,can,history=[],reservations=[]}){
 const enabled=skuPanelModes.filter(m=>can(m.permission));
 const modes=enabled.map(m=>'<button type="button" class="sku-mode-button" role="tab" aria-selected="false" data-action="sku-mode" data-mode="'+m.key+'"><span aria-hidden="true">'+m.icon+'</span>'+m.label+'</button>').join('');
 const locate=[item.gondola?'Gôndola '+item.gondola:'',item.prateleira?'Prateleira '+item.prateleira:''].filter(Boolean).join(' · ')||'Localização não informada';
 const title=model?.name||item.name;
 const disabledInfo=!item.active?'<p class="sku-panel-alert">SKU inativo. Ative-o antes de movimentar ou contar.</p>':'';
 const historyHTML=history.slice(0,15).map(m=>'<li><span>'+safe(m.action||'Movimento')+
  '<small>'+safe(m.note||'Sem observação')+'</small></span>'+
  '<span><b>'+fmt(m.quantity)+' un.</b><small>'+safe(m.created_at?new Date(m.created_at).toLocaleDateString('pt-BR'):'')+'</small></span></li>').join('');
 const linked=reservations.map(r=>'<li>'+(r.avulso_order_id?'Cliente / avulso':'Loja')+' #'+safe(String(r.avulso_order_id||r.order_id||'').slice(0,8).toUpperCase())+
  ' · '+fmt(r.quantity)+' un.</li>').join('');
 return '<div class="sku-manage-sheet">'+
  '<header class="sku-manage-title"><strong>'+safe(title)+'</strong>'+
  '<span>'+safe([item.apparel_color,item.apparel_size].filter(Boolean).join(' · ')||'Produto único')+'</span>'+
  '<small>SKU '+safe(item.sku||'—')+' · EAN '+safe(item.ean||'—')+'</small></header>'+
  '<div class="sku-stock-metrics" aria-label="Saldo do tamanho">'+
    '<div><small>Físico</small><strong>'+fmt(physical)+'</strong></div>'+
    '<div><small>Reservado</small><strong>'+fmt(reserved)+'</strong></div>'+
    '<div class="sku-stock-free"><small>Livre</small><strong>'+fmt(Math.max(0,physical-reserved))+'</strong></div>'+
  '</div>'+
  '<p class="sku-location">⌖ '+safe(locate)+' · Estoque central</p>'+
  disabledInfo+
  (enabled.length?'<div class="sku-mode-tabs" role="tablist" aria-label="Operações do SKU">'+modes+'</div>':
    '<p class="help">Seu perfil permite apenas consultar este SKU.</p>')+
  '<section class="sku-mode-section" data-sku-section="entrada" hidden>'+
    '<p class="sku-section-help">Mercadoria recebida do fornecedor. A quantidade será somada ao estoque físico.</p>'+
    '<label class="field"><span>Unidades recebidas</span><input name="entry_qty" type="number" inputmode="numeric" min="1" max="1000000" step="1" value="1"></label>'+
    '<label class="field"><span>Fornecedor / referência da remessa (opcional)</span>'+
      '<textarea name="entry_note" maxlength="400" placeholder="Ex.: remessa de outubro"></textarea></label>'+
  '</section>'+
  '<section class="sku-mode-section" data-sku-section="saida" hidden>'+
    '<p class="sku-section-help">Saída excepcional. Não é possível usar unidades reservadas.</p>'+
    '<label class="field"><span>Unidades retiradas</span><input name="exit_qty" type="number" inputmode="numeric" min="1" max="'+Math.max(0,physical-reserved)+'" step="1" value="1"></label>'+
    '<label class="field"><span>Motivo</span><select name="exit_reason">'+
      '<option value="avaria">Avaria — enviar para análise</option>'+
      '<option value="extravio">Perda / extravio</option>'+
      '<option value="diretoria">Uso da diretoria</option>'+
      '<option value="doacao">Doação</option>'+
      '<option value="outro">Outro motivo</option></select></label>'+
    '<label class="field" data-sku-recipient hidden><span>Quem recebeu?</span>'+
      '<input name="exit_recipient" type="text" maxlength="120" placeholder="Nome / identificação"></label>'+
    '<label class="field"><span>Justificativa obrigatória</span>'+
      '<textarea name="exit_note" maxlength="250" placeholder="Descreva o que aconteceu"></textarea></label>'+
    '<p class="sku-section-help">Avarias ficam suspensas e podem ser recuperadas. Os outros motivos geram baixa definitiva.</p>'+
  '</section>'+
  '<section class="sku-mode-section" data-sku-section="contagem" hidden>'+
    '<p class="sku-section-help">Conte fisicamente todas as unidades deste tamanho, inclusive as reservadas. Zero é uma contagem válida.</p>'+
    '<label class="field"><span>Quantidade encontrada</span>'+
      '<input name="count_qty" type="number" inputmode="numeric" min="0" max="1000000" step="1" value="'+Number(physical)+'"></label>'+
    '<label class="field"><span>Motivo da diferença</span>'+
      '<textarea name="count_note" maxlength="250" placeholder="Ex.: divergência na contagem"></textarea></label>'+
  '</section>'+
  '<section class="sku-mode-section" data-sku-section="edicao" hidden>'+
    '<p class="sku-section-help">Atualize o cadastro sem movimentar a quantidade física.</p>'+
    '<label class="field"><span>Descrição da variação</span><input name="edit_name" maxlength="180" value="'+safe(item.name)+'"></label>'+
    '<div class="sku-edit-grid">'+
      '<label class="field"><span>SKU</span><input name="edit_sku" maxlength="80" value="'+safe(item.sku||'')+'"></label>'+
      '<label class="field"><span>EAN (8 a 14 dígitos)</span><input name="edit_ean" inputmode="numeric" maxlength="14" value="'+safe(item.ean||'')+'"></label>'+
      '<label class="field"><span>Gôndola</span><input name="edit_gondola" maxlength="40" value="'+safe(item.gondola||'')+'"></label>'+
      '<label class="field"><span>Prateleira</span><input name="edit_prateleira" maxlength="40" value="'+safe(item.prateleira||'')+'"></label>'+
    '</div>'+
    '<button type="button" class="button sku-edit-more" data-action="sku-edit-advanced">Editar cor, tamanho ou foto…</button>'+
  '</section>'+
  '<div class="sku-preview" role="status" data-sku-preview aria-live="polite"></div>'+
  '<details class="sku-panel-details"><summary>Reservas / pedidos ('+reservations.length+')</summary>'+
    (linked?'<ul>'+linked+'</ul>':'<p>Nenhuma reserva ativa neste tamanho.</p>')+'</details>'+
  '<details class="sku-panel-details" data-sku-history><summary>Histórico recente do SKU</summary>'+
    '<ul class="sku-history-list">'+historyHTML+'</ul>'+
    (!historyHTML?'<p data-sku-history-empty>Não há movimentos recentes acessíveis ao seu perfil.</p>':'')+
    '<small>Últimos movimentos disponíveis. Consulte Movimentações para o histórico completo.</small></details>'+
 '</div>';
}
export function validateSkuAction({mode,values,physical,reserved}){
 const qtyField={entrada:'entry_qty',saida:'exit_qty',contagem:'count_qty'}[mode];
 if(qtyField){
  const raw=String(values[qtyField]??'').trim();
  if(!/^(0|[1-9][0-9]{0,6})$/.test(raw))throw Error('Informe uma quantidade inteira entre 0 e 1.000.000.');
  const qty=Number(raw);
  if(!Number.isInteger(qty)||qty>1000000)throw Error('Quantidade acima do limite de 1.000.000.');
  if((mode==='entrada'||mode==='saida')&&qty<1)throw Error('Informe pelo menos uma unidade.');
  if(mode==='saida'&&qty>Math.max(0,physical-reserved))
   throw Error('Estoque livre insuficiente. Unidades reservadas não podem ser baixadas.');
  if(mode==='contagem'){
   if(qty<reserved)throw Error('A contagem não pode ficar abaixo de '+reserved+' unidade(s) reservada(s).');
   const note=String(values.count_note||'').trim();
   if(qty!==physical&&(note.length<5||note.length>250))
    throw Error('Explique a divergência em 5 a 250 caracteres.');
   return {quantity:qty,note};
  }
  if(mode==='entrada'){
   const note=String(values.entry_note||'').trim();
   if(note.length>400)throw Error('Referência da remessa muito longa.');
   return {quantity:qty,note};
  }
  const reason=String(values.exit_reason||''),note=String(values.exit_note||'').trim();
  const recipient=String(values.exit_recipient||'').trim();
  if(!['avaria','extravio','diretoria','doacao','outro'].includes(reason))throw Error('Escolha o motivo da saída.');
  if(note.length<5||note.length>250)throw Error('Justifique a saída em 5 a 250 caracteres.');
  if(['diretoria','doacao'].includes(reason)&&(recipient.length<2||recipient.length>120))
   throw Error('Informe quem recebeu, com 2 a 120 caracteres.');
  return {quantity:qty,reason,note,recipient:['diretoria','doacao'].includes(reason)?recipient:null};
 }
 if(mode==='edicao'){
  const name=String(values.edit_name||'').trim();
  const sku=String(values.edit_sku||'').trim();
  const ean=String(values.edit_ean||'').replace(/[\s-]/g,'');
  if(!name||name.length>180)throw Error('Informe uma descrição válida.');
  if(sku.length>80)throw Error('SKU acima de 80 caracteres.');
  if(ean&&!/^\d{8,14}$/.test(ean))throw Error('EAN deve ter entre 8 e 14 dígitos.');
  const gondola=String(values.edit_gondola||'').trim(),prateleira=String(values.edit_prateleira||'').trim();
  if(gondola.length>40||prateleira.length>40)throw Error('Localização acima de 40 caracteres.');
  return {name,sku:sku||null,ean:ean||null,gondola:gondola||null,prateleira:prateleira||null};
 }
 throw Error('Operação indisponível.');
}
