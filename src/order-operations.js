// Etapas de pedido: quantidades solicitadas, separadas e conferidas preservadas por SKU.
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function operationalStage(order){
 const workflow=order?.workflow;
 if(workflow?.stage==='expedicao')return 'expedicao';
 if(workflow?.stage==='enviado')return 'enviado';
 if(workflow?.stage==='conferencia')return 'conferencia';
 if(workflow?.stage==='separacao')return 'separacao';
 if(order?.status==='separado')return 'conferencia';
 if(['enviado','despachado','concluido','recebido','recebido_divergente'].includes(order?.status))return 'enviado';
 return 'separacao';
}
export function operationalDifferenceRows(order){
 const items=order?.workflow?.items||{};
 return (order?.lines||[]).map(line=>{
  const row=items[line.id]||{};
  const requested=Number(line.quantity||0);
  const picked=row.picked==null?null:Number(row.picked);
  const counted=row.counted==null?null:Number(row.counted);
  return {id:line.id,name:line.modelTitle||line.name,size:line.size,
   requested,picked,counted,
   missing:requested-(counted??picked??requested),
   reason:String(row.check_reason||row.pick_reason||''),
   divergent:(picked!==null&&picked!==requested)||(counted!==null&&counted!==requested)||
     (counted!==null&&picked!==null&&counted!==picked)};
 }).filter(x=>x.divergent);
}
export function operationalFormMarkup(order,mode='separacao',verifications=[]){
 const stored=order?.workflow?.items||{};
 const total=order?.lines?.reduce((sum,x)=>sum+Number(x.quantity||0),0)||0;
 const rows=(order?.lines||[]).slice().sort((a,b)=>
   String(a.gondola||'').localeCompare(String(b.gondola||''),'pt-BR',{numeric:true})||
   String(a.modelTitle||a.name).localeCompare(String(b.modelTitle||b.name),'pt-BR',{numeric:true}))
 .map(line=>{
  const entry=stored[line.id]||{};
  const old=verifications.find(v=>v.product_id===line.id);
  const existing=mode==='conferencia'?(entry.counted??old?.counted_quantity??null):
    (entry.picked??(order.status==='em_separacao'?line.picked:null));
  const reason=mode==='conferencia'?entry.check_reason||'':entry.pick_reason||'';
  return '<article class="op-line" data-op-line data-product="'+escapeHtml(line.id)+'" data-expected="'+Number(line.quantity)+'">'+
   '<div class="op-line-heading">'+
   (line.imagePath?'<img data-photo-path="'+escapeHtml(line.imagePath)+'" alt="Foto de '+escapeHtml(line.name)+'">':'')+
   '<div><strong>'+escapeHtml(line.modelTitle||line.name)+'</strong>'+
   '<small>'+escapeHtml([line.color,line.size].filter(Boolean).join(' · '))+
   ' · SKU '+escapeHtml(line.sku||'—')+'</small>'+
   '<small>EAN '+escapeHtml(line.ean||'—')+' · '+
   escapeHtml(line.gondola?'Gôndola '+line.gondola:'Sem gôndola')+'</small></div>'+
   '<b>Pedido: '+Number(line.quantity)+' un.</b></div>'+
   '<div class="op-fields"><label>Quantidade '+(mode==='conferencia'?'conferida':'encontrada')+
   '<input required data-op-qty type="number" min="0" max="'+Number(line.quantity)+'" step="1" inputmode="numeric"'+
   ' value="'+(existing==null?'':Number(existing))+'" placeholder="0 a '+Number(line.quantity)+'"></label>'+
   '<label>Motivo da divergência (quando houver)'+
   '<input data-op-reason maxlength="250" value="'+escapeHtml(reason)+'" placeholder="Ex.: produto não localizado / faltaram peças"></label></div></article>';
 }).join('');
 return '<div class="op-workflow">'+
  '<p class="op-intro"><strong>'+escapeHtml(order.code||'Pedido')+' · '+escapeHtml(order.target||'')+'</strong>'+
  ' · '+total+' unidades solicitadas. Informe uma quantidade em cada SKU, inclusive zero quando não encontrado. '+
  (mode==='separacao'?'A falta não impede concluir a separação, desde que seja justificada.':
    'Conferência independente: confirme a contagem real. Divergências seguem para expedição com alerta.')+'</p>'+
  '<div class="op-summary">Solicitadas: <b>'+total+'</b> · '+
  (mode==='conferencia'?'Contagem de conferência':'Contagem da separação')+'</div>'+
  '<div class="op-lines">'+rows+'</div>'+
  '<p class="op-warning">A saída física só será registrada na etapa de envio, pelo usuário autorizado.</p>'+
 '</div>';
}
