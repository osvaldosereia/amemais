// Conferência final por leitor EAN/SKU + quantidade física.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function verificationProgress(order,rows=[]){
 const map=new Map(rows.filter(r=>r.kind===order.kind&&r.order_id===order.id)
  .map(r=>[r.product_id,r]));
 const list=order.lines.map(line=>{
  const record=map.get(line.id);
  const actual=record?Number(record.counted_quantity):null;
  const ok=actual===Number(line.quantity) &&
   Number(record.expected_quantity)===Number(line.quantity);
  return {...line,actual,ok,verification:record||null};
 });
 return {lines:list,
   matched:list.filter(x=>x.ok).length,total:list.length,
   units:list.filter(x=>x.ok).reduce((sum,x)=>sum+Number(x.quantity||0),0),
   allUnits:list.reduce((sum,x)=>sum+Number(x.quantity||0),0),
   complete:list.length>0&&list.every(x=>x.ok)};
}
export function findVerificationProduct(order,code){
 const text=String(code??'').trim();
 if(!text)return {error:'Leia o EAN ou o código interno.'};
 const matches=order.lines.filter(x=>[x.ean,x.sku].some(v=>String(v||'')===text));
 if(!matches.length)return {error:'Este EAN/SKU não pertence ao pedido.'};
 if(matches.length>1)return {error:'Código vinculado a mais de uma variação. Corrija o cadastro.'};
 return {line:matches[0]};
}
export function finalVerificationMarkup(order,rows=[]){
 const progress=verificationProgress(order,rows);
 const pct=progress.total?Math.round(100*progress.matched/progress.total):0;
 const cards=progress.lines.map(x=>{
  const label=x.color&&x.color!=='Única'?x.color+' · '+(x.size||''):x.size||'Única';
  const badge=x.ok?'Conferido':x.actual!==null?'Divergência':'Pendente';
  return '<div class="verify-item'+(x.ok?' verified':x.actual!==null?' divergent':'')+'" data-verify-product="'+esc(x.id)+'">'+
   '<div class="verify-photo">'+(x.imagePath?'<img data-photo-path="'+esc(x.imagePath)+'" alt="'+esc(x.modelTitle||x.name)+'">':'Sem foto')+'</div>'+
   '<div class="verify-details"><strong>'+esc(x.modelTitle||x.name)+'</strong>'+
    '<span>'+esc(label)+'</span>'+
    '<small>EAN '+esc(x.ean||'—')+' · SKU '+esc(x.sku||'—')+'</small>'+
    '<small>'+esc([x.gondola?'Gôndola '+x.gondola:'Sem gôndola',x.prateleira?'Prateleira '+x.prateleira:''].filter(Boolean).join(' · '))+'</small>'+
    '<div class="verify-line-bottom"><b>'+esc(badge)+'</b><span>'+(x.actual===null?x.quantity+' un. solicitadas':x.actual+' / '+x.quantity+' un.')+'</span></div>'+
   '</div></div>';
 }).join('');
 return '<section class="verify-workflow">'+
  '<p class="verify-lead">Leia <strong>um EAN por SKU</strong>, conte as peças e informe a quantidade encontrada. A conferência é salva automaticamente após confirmar cada item.</p>'+
  '<div class="verify-progress"><div><strong>'+progress.matched+' de '+progress.total+' SKUs</strong>'+
   '<span>'+progress.units+' de '+progress.allUnits+' un. conferidas</span></div>'+
   '<div class="verify-track"><div style="width:'+pct+'%"></div></div></div>'+
  '<label class="field"><span>Leitura do EAN ou código interno</span>'+
   '<input type="search" name="verify_barcode" data-verify-scan autocomplete="off" autocapitalize="off" spellcheck="false"'+
   ' placeholder="Passe o leitor ou digite o código e pressione Enter"></label>'+
  '<div class="verify-feedback" data-verify-feedback role="status" aria-live="polite">'+
   (progress.complete?'Conferência completa. Pedido liberado para confirmar a saída.':
    'Passe um produto no leitor para informar sua quantidade.')+'</div>'+
  '<div data-verify-selected hidden class="verify-selected">'+
   '<strong data-verify-selected-name></strong>'+
   '<label class="field"><span>Quantidade física encontrada</span>'+
    '<input type="number" name="verify_quantity" data-verify-quantity min="0" max="1000000" step="1" inputmode="numeric" placeholder="Digite a quantidade contada"></label>'+
   '<button type="button" class="button primary" data-action="verify-confirm-item">Confirmar quantidade deste SKU</button>'+
  '</div>'+
  '<div class="verify-items">'+cards+'</div>'+
 '</section>';
}
export function verificationCanDispatch(order,rows){
 return verificationProgress(order,rows).complete;
}
