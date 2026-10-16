// Cadastro reutilizável de gôndolas no CDSB; produtos retêm o código/nome textual.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
export function gondolaSelectHTML(fieldName,locations=[],selected='',{label='Gôndola',disabled=false}={}){
 const current=String(selected||'').trim();
 const active=locations.filter(g=>g.active||g.name===current)
  .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{numeric:true}));
 const exists=active.some(g=>g.name===current);
 const options=[...active];
 if(current&&!exists)options.push({id:'legacy-'+current,name:current,active:false});
 const labelText=fieldName==='gondola'?label:label;
 return '<label class="field gondola-select-field"><span>'+esc(labelText)+'</span>'+
  '<select name="'+esc(fieldName)+'"'+(disabled?' disabled':'')+'>'+
  '<option value=""'+(!current?' selected':'')+'>Sem gôndola definida</option>'+
  options.map(g=>'<option value="'+esc(g.name)+'"'+(g.name===current?' selected':'')+'>'+
   esc(g.name)+(g.active?'':' (local antigo — selecionada)')+'</option>').join('')+
  '</select><small>Cadastre e organize gôndolas na seção Gôndolas.</small></label>';
}
export function gondolasPageHTML(locations=[],{button=()=>'',canManage=false}={}){
 const list=locations.slice().sort((a,b)=>Number(b.active)-Number(a.active)||a.name.localeCompare(b.name,'pt-BR',{numeric:true}));
 return '<div class="gondolas-page">'+
  '<header class="pagehead"><div><h1>Gôndolas</h1><p>Cadastre os locais de armazenamento para selecionar no cadastro de produtos e variações.</p></div>'+
  (canManage?button('+ Nova gôndola','gondola-new','','primary'):'')+'</header>'+
  '<section class="panel gondolas-list"><div class="panelhead"><h2>Locais cadastrados</h2><span>'+list.length+' gôndola(s)</span></div>'+
  '<div class="gondolas-rows">'+(list.length?list.map(g=>'<article class="gondola-row">'+
   '<div><strong>'+esc(g.name)+'</strong><small>'+(g.active?'Disponível para novos cadastros':'Inativa — preservada nos produtos existentes')+'</small></div>'+
   (canManage?'<div class="actions">'+button('Editar','gondola-edit','data-id="'+esc(g.id)+'"','small')+
     button(g.active?'Desativar':'Ativar','gondola-toggle','data-id="'+esc(g.id)+'"','small')+'</div>':'')+
   '</article>').join(''):'<p class="su-empty">Nenhuma gôndola cadastrada. Cadastre a primeira para utilizá-la nos produtos.</p>')+
  '</div></section></div>';
}
