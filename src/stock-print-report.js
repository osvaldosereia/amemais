// Relatório A4 vertical: seleção dos filtros de Produtos, 1 ficha por modelo e linhas por SKU.
// Somente dados recebidos de um contexto de estoque já autorizado.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('pt-BR');
const num=x=>Math.max(0,Number(x)||0);
const location=p=>[p.gondola?'Gôndola '+p.gondola:'',p.prateleira?'Prateleira '+p.prateleira:''].filter(Boolean).join(' · ')||'—';
export function stockPrintGroups(items,models,balances,reservations,{includeInactive=false,groupOrder=null}={}){
 const printedOrder=new Map((groupOrder||[]).map((key,index)=>[key,index]));
 const mdl=new Map(models.map(m=>[m.id,m])),balance=new Map(),reserved=new Map(),groups=new Map();
 for(const b of balances)if(!b.event_id)balance.set(b.product_id,(balance.get(b.product_id)||0)+num(b.quantity));
 for(const r of reservations)if(r.status==='ativa')reserved.set(r.product_id,(reserved.get(r.product_id)||0)+num(r.quantity));
 for(const p of items){
  if((!p.active&&!includeInactive)||p.force_archived_at)continue;
  const key=p.apparel_model_id?'model:'+p.apparel_model_id:'single:'+p.id;
  if(!groups.has(key))groups.set(key,{key,model:mdl.get(p.apparel_model_id),items:[]});
  groups.get(key).items.push(p);
 }
 return [...groups.values()].map(group=>{
  const base=group.model||group.items[0];
  const rows=group.items.map(p=>{
   const physical=balance.get(p.id)||0,held=reserved.get(p.id)||0;
   return {id:p.id,name:p.name,size:p.apparel_size||'Único',color:p.apparel_color||'',active:p.active,
    sku:p.sku||'',ean:p.ean||'',location:location(p),gondola:p.gondola||'',
    physical,reserved:held,available:Math.max(0,physical-held),minimum:num(p.min_stock)};
  }).sort((a,b)=>{
   const order=['PP','P','M','G','GG','XGG','XXGG','EXGG','Único'];
   const ai=order.indexOf(a.size),bi=order.indexOf(b.size);
   return (ai<0?100:ai)-(bi<0?100:bi)||a.color.localeCompare(b.color,'pt-BR')||
    a.size.localeCompare(b.size,'pt-BR',{numeric:true});
  });
  const colors=[...new Set(rows.map(r=>r.color).filter(Boolean))];
  return {key:group.key,title:base.name||group.items[0].name,color:colors.join(' · '),
   photoPath:group.model?.image_path||group.model?.image_paths?.[0]||
    group.items.find(p=>p.image_path)?.image_path||group.items.find(p=>p.image_paths?.length)?.image_paths?.[0]||'',
   rows,total:rows.reduce((sum,row)=>({
    physical:sum.physical+row.physical,reserved:sum.reserved+row.reserved,
    available:sum.available+row.available,minimum:sum.minimum+row.minimum
   }),{physical:0,reserved:0,available:0,minimum:0})};
 }).sort((a,b)=>{
   if(groupOrder){
     const orderKey=g=>g.key.startsWith('single:')?'product:'+g.key.slice(7):g.key;
     const ai=printedOrder.get(orderKey(a)),bi=printedOrder.get(orderKey(b));
     if(ai!==undefined||bi!==undefined)return (ai??Infinity)-(bi??Infinity);
   }
   return a.title.localeCompare(b.title,'pt-BR');
 });
}
export function stockPrintHTML(groups,photoUrls={},printedAt=new Date().toLocaleString('pt-BR'),selectionLabel=''){
 const totals=groups.reduce((total,group)=>({
  physical:total.physical+group.total.physical,
  reserved:total.reserved+group.total.reserved,
  available:total.available+group.total.available,
  variations:total.variations+group.rows.length
 }),{physical:0,reserved:0,available:0,variations:0});
 const cards=groups.map(group=>{
  const image=group.photoPath&&photoUrls[group.photoPath]
   ?'<img src="'+esc(photoUrls[group.photoPath])+'" alt="Foto de '+esc(group.title)+'">'
   :'<div class="no-photo">Sem foto<br>cadastrada</div>';
  const locations=[...new Set(group.rows.map(r=>r.location).filter(l=>l!=='—'))];
  const place=locations.length===1?locations[0]:locations.length>1?'Localização indicada por variação':'Gôndola não informada';
  const rows=group.rows.map(row=>'<div class="variant'+(row.active===false?' is-inactive':'')+'">'+
   '<span class="variation">'+esc([row.color,row.size].filter(Boolean).join(' · '))+(row.active===false?' <em>Inativo</em>':'')+'</span>'+
   '<span class="code">'+esc(row.sku||'—')+'</span>'+
   '<span class="ean">'+esc(row.ean||'—')+'</span>'+
   '<span class="where">'+esc(row.location)+'</span>'+
   '<b class="qty">'+fmt(row.physical)+'</b><b class="qty">'+fmt(row.reserved)+'</b>'+
   '<b class="qty available">'+fmt(row.available)+'</b><b class="qty">'+fmt(row.minimum)+'</b></div>').join('');
  return '<article class="stock-card"><div class="photo">'+image+'</div><section class="right">'+
   '<header class="product-heading"><div class="product-main"><h2>'+esc(group.title)+'</h2>'+
   (group.color?'<span>'+esc(group.color)+'</span>':'')+
   '<span class="place">'+esc(place)+'</span></div>'+
   '<div class="totals"><span>Físico <b>'+fmt(group.total.physical)+'</b></span>'+
   '<span>Reservado <b>'+fmt(group.total.reserved)+'</b></span>'+
   '<span>Livre <b>'+fmt(group.total.available)+'</b></span>'+
   '<span>Mín. <b>'+fmt(group.total.minimum)+'</b></span></div></header>'+
   '<div class="variant-head"><span>Cor / Tamanho</span><span>SKU</span><span>EAN</span><span>Gôndola / Localização</span>'+
   '<span>Fís.</span><span>Res.</span><span>Livre</span><span>Mín.</span></div>'+
   rows+'</section></article>';
 }).join('');
 const css = `
@page{size:A4 portrait;margin:9mm}
*{box-sizing:border-box}
html,body{padding:0;margin:0;color:#163829;max-width:none}
body{font:8pt Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.report-header{display:flex;justify-content:space-between;align-items:flex-start;gap:5mm;border-bottom:1.5px solid #18704b;padding:1mm 0 3mm;margin-bottom:3mm}
.report-header>div{min-width:0;flex:1}
.report-header h1{font-size:13pt;margin:1mm 0 0}
.report-header small{display:block;color:#46775e;font-size:7pt}
.report-header aside{text-align:right;font-size:7pt;line-height:1.45;color:#355f49;flex:0 1 75mm}
.selection{font-size:7.4pt;color:#315e45;margin:2mm 0 1mm;overflow-wrap:anywhere;line-height:1.35}
.stock-card{display:grid;grid-template-columns:33mm minmax(0,1fr);gap:2.5mm;border:1px solid #d1dfd6;border-radius:2mm;margin:0 0 2.5mm;padding:2mm;min-height:34mm;break-inside:avoid;page-break-inside:avoid;overflow:hidden}
.photo{width:100%;height:100%;min-height:30mm;position:relative;border-radius:1.4mm;overflow:hidden;background:#f1f5f1;display:flex;align-items:center;justify-content:center}
.photo img{display:block;width:100%;height:100%;position:absolute;inset:0;object-fit:cover}
.no-photo{color:#72877b;text-align:center;font-size:7.2pt;line-height:1.4;padding:2mm}
.right{min-width:0;display:flex;flex-direction:column;gap:.8mm}
.product-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:2mm;min-width:0;padding-bottom:1mm}
.product-main{display:flex;flex-direction:column;gap:.5mm;min-width:0;flex:1}
.product-main h2{font-size:9.4pt;color:#144d35;margin:0;overflow-wrap:anywhere;line-height:1.18}
.product-main span{font-size:6.6pt;color:#5c7665;overflow-wrap:anywhere}
.product-main .place{font-weight:700;color:#275f40}
.totals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8mm;flex:0 0 auto;min-width:40mm;max-width:49mm}
.totals span{display:flex;flex-direction:column;text-align:center;padding:.9mm .6mm;border-radius:1.2mm;background:#eff5f0;white-space:nowrap;color:#47715a;font-size:5.6pt}
.totals b{font-size:8pt;color:#175f40}
.totals span:nth-child(3){background:#e2f1e5}.totals span:nth-child(3) b{color:#12623b}
.variant-head,.variant{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(0,.75fr) minmax(0,.95fr) minmax(0,1.28fr) repeat(4,minmax(0,.43fr));gap:.9mm;align-items:center;padding:.9mm .5mm}
.variant-head{background:#e9f2eb;color:#3f6450;font-weight:700;font-size:5.55pt;white-space:nowrap;border-radius:.7mm}
.variant{font-size:6.2pt;border-bottom:1px solid #e6eee7;min-height:5mm}.variant:last-child{border:0}
.variant>span{overflow-wrap:anywhere}.variation{font-weight:700;color:#1d4831}.variation em{font-weight:400;color:#a75a42;font-size:5pt}
.where{color:#466a52}
.qty{text-align:right;font-variant-numeric:tabular-nums;font-size:6.6pt}.qty.available{color:#0b7546}
.footer{margin-top:3mm;color:#587563;font-size:6.5pt;display:flex;justify-content:space-between;gap:4mm}
@media screen{body{max-width:210mm;margin:auto;padding:9mm;background:#fff}.stock-card{box-shadow:0 1px 4px #d5dfd6}}
@media print{body{width:100%} .report-header{break-after:avoid} .stock-card{break-inside:avoid;page-break-inside:avoid} .footer{break-inside:avoid}}
`;
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Posição de estoque · CDSB</title>'+
 '<style>'+css+

 '<div class="report-header"><div><small>CDSB · CENTRO DE DISTRIBUIÇÃO SÃO BENTO</small>'+
 '<h1>Posição de estoque</h1>'+(selectionLabel?'<p class="selection">'+esc(selectionLabel)+'</p>':'')+'</div><aside>Emissão: '+esc(printedAt)+'<br>'+
 fmt(groups.length)+' produtos · '+fmt(totals.variations)+' variações · '+fmt(totals.physical)+' unidades físicas'+
 '<br>'+fmt(totals.reserved)+' reservadas · '+fmt(totals.available)+' livres</aside></div>'+
 (cards||'<p>Nenhum produto ativo.</p>')+
 '<div class="footer"><span>Estoque físico na central; reservas virtuais não reduzem o físico.</span>'+
 '<span>Documento de conferência · CDSB</span></div>'+
 '<script>window.addEventListener("load",()=>{window.focus();window.print()},{once:true});</script>'+
 '</body></html>';
}
