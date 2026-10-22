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
// Variações por categoria. null = herdar da categoria superior; [] = produto sem variações.
export const defaultNoVariations=[];
export const escapeVariant = value=>String(value??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const normalize=value=>String(value||'').trim().toLocaleLowerCase('pt-BR');
export function parseCategoryVariations(value){
 const entries=String(value??'').split(/[,;\n\r]+/).map(s=>s.trim()).filter(Boolean);
 if(entries.length>32)throw new Error('Limite de 32 variações por categoria.');
 const seen=new Set();
 for(const entry of entries){
  if(entry.length>16)throw new Error('Cada variação pode ter até 16 caracteres: '+entry);
  const key=normalize(entry);
  if(seen.has(key))throw new Error('Variação repetida: '+entry);
  seen.add(key);
 }
 return entries;
}
export function resolveCategoryVariations(categories,categoryId){
 const map=new Map((categories||[]).map(c=>[c.id,c]));
 let c=map.get(categoryId),steps=0;
 const seen=new Set();
 while(c&&!seen.has(c.id)&&steps<15){
  seen.add(c.id);steps++;
  if(Array.isArray(c.variation_options))return {
   options:c.variation_options,source:c.id,inherited:c.id!==categoryId
  };
  c=map.get(c.parent_id);
 }
 return {options:[],source:null,inherited:false};
}
// Metadados técnicos do modelo vêm da hierarquia de categorias, sem repedir informações no cadastro.
export function inferApparelMetadata(categories,categoryId){
 const map=new Map((categories||[]).map(cat=>[cat.id,cat]));
 const parents=[],seen=new Set();let current=map.get(categoryId);
 while(current&&!seen.has(current.id)&&parents.length<20){
  parents.push(String(current.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim());
  seen.add(current.id);current=map.get(current.parent_id);
 }
 const match=(regex)=>parents.find(name=>regex.test(name));
 const garmentTypes=[
  [/^(camiseta|camisetas|baby look|babylook)\b/,'Camiseta'],
  [/^camisa(s)?\b/,'Camisa'],
  [/^polo(s)?\b/,'Polo'],
  [/^blusa(s)?\b/,'Blusa'],
  [/^vestido(s)?\b/,'Vestido'],
  [/^(casaco|casacos|jaqueta|jaquetas)\b/,'Casaco']
 ];
 const type=garmentTypes.find(([pattern])=>match(pattern))?.[1]||'Outro';
 const audience=match(/^(masculino|masculina|masculinos)\b/)?'Masculino':
  match(/^(feminino|feminina|femininos|baby look|babylook)\b/)?'Feminino':'Unissex';
 const ageGroup=match(/^(bebe|bebes|baby)$/)?'Bebê':match(/^(infantil|crianca|criancas|juvenil)\b/)?'Infantil':'Adulto';
 return {type,audience,ageGroup};
}
export function syncApparelCategoryMetadata(form,categories){
 if(!form)return;
 const panel=form.querySelector('[data-variant-panel]');
 if(!panel)return;
 const id=form.querySelector('input[name="category_id"]')?.value||'';
 const meta=inferApparelMetadata(categories,id);
 for(const [name,val] of [['apparel_type',meta.type],['apparel_audience',meta.audience],['apparel_age',meta.ageGroup]]){
  const input=panel.querySelector('[name="'+name+'"]');
  if(input)input.value=val;
 }
 const desc=panel.querySelector('[data-apparel-category-summary]');
 if(desc)desc.textContent=id?'Classificação pela categoria: '+[meta.type,meta.audience,meta.ageGroup].join(' · ')+'.':'Selecione uma categoria para definir a classificação do produto.';
}
export function categoryVariationLabel(categories,categoryId){
 const found=resolveCategoryVariations(categories,categoryId);
 return found.options.length?found.options.join(' · '):'Sem variações configuradas';
}
export function renderCategoryVariationFields(category,categories){
 const h=escapeVariant;
 const inherited=resolveCategoryVariations(categories,category?.parent_id||'');
 const mode=category?.variation_options===null||category?.variation_options===undefined?'inherit':
  category?.variation_options?.length?'custom':'none';
 const inheritAllowed=Boolean(category?.parent_id);
 const chosenMode=!inheritAllowed&&mode==='inherit'?'none':mode;
 return '<section class="category-variants-form form-section wide">'+
  '<div class="section-head"><strong>Variações dos produtos</strong></div>'+
  '<p class="help">Configure uma vez por categoria ou subcategoria. Ex.: Camiseta — P, M, G, GG, XGG; Chapéu — Tamanho 10, Tamanho 12, Tamanho 14.</p>'+
  '<label class="field"><span>Como configurar</span><select name="variation_mode" data-variation-mode>'+
   (inheritAllowed?'<option value="inherit"'+(chosenMode==='inherit'?' selected':'')+'>Herdar da categoria superior</option>':'')+
   '<option value="custom"'+(chosenMode==='custom'?' selected':'')+'>Definir variações nesta categoria</option>'+
   '<option value="none"'+(chosenMode==='none'?' selected':'')+'>Sem variações</option></select></label>'+
  '<label class="field" data-variation-custom'+(chosenMode==='custom'?'':' hidden')+'>'+
   '<span>Variações (separe por vírgula ou uma por linha)</span>'+
   '<textarea name="variation_labels" rows="3" maxlength="700" placeholder="P, M, G, GG, XGG">'+
     h((category?.variation_options||[]).join(', '))+'</textarea>'+
  '</label>'+
  (inheritAllowed?'<p class="help">Da categoria superior: '+h(inherited.options.join(' · ')||'Nenhuma opção')+'</p>':'')+
  '<p class="help">Alterações valem para novos tamanhos. Os SKUs e estoques já cadastrados são preservados.</p></section>';
}
export function variationOptionsToSave(form){
 const mode=form.querySelector('[name="variation_mode"]')?.value||'inherit';
 if(mode==='inherit')return null;
 if(mode==='none')return [];
 if(mode==='custom'){
  const options=parseCategoryVariations(form.querySelector('[name="variation_labels"]')?.value||'');
  if(!options.length)throw new Error('Informe pelo menos uma variação ou escolha Sem variações.');
  return options;
 }
 throw new Error('Modo de variações inválido.');
}
export function makeVariationCards(options,gondolas=[]){
 const h=escapeVariant;
 return options.map(label=>'<div class="size-variant-card" data-size-variant="'+h(label)+'">'+
  '<div class="size-variant-heading"><strong>'+h(label)+'</strong>'+
    '</div>'+
  '<div class="size-fields">'+
   '<label class="field"><span>SKU (opcional)</span><input name="size_sku" maxlength="80" disabled placeholder="Gerado automaticamente"></label>'+
   '<label class="field"><span>EAN (opcional)</span><div class="inline apparel-ean">'+
    '<input name="size_ean" inputmode="numeric" maxlength="14" disabled placeholder="Código de barras">'+
    '<button type="button" class="button small" data-action="size-scan">📷</button></div></label>'+
   gondolaSelectHTML('size_gondola',gondolas,'',{label:'Gôndola deste tamanho',disabled:true})+
   '<label class="field"><span>Prateleira</span><input name="size_prateleira" maxlength="40" disabled placeholder="Ex.: B"></label>'+
   '<label class="field"><span>Estoque inicial</span><input name="size_qty" type="number" step="1" min="0" max="1000000" placeholder="Em branco = não cadastrar" inputmode="numeric"></label>'+
  '</div></div>').join('');
}
export function makeVariationChips(options){
 const h=escapeVariant;
 return options.map(label=>'<button type="button" class="size-chip" aria-pressed="false" data-action="size-toggle" data-size="'+h(label)+'">'+h(label)+'</button>').join('');
}
export function refreshCategorySizeOptions(form,categories,gondolas=[]){
 const picker=form?.querySelector('[data-variant-panel]');
 if(!picker)return;
 syncApparelCategoryMetadata(form,categories);
 const categoryId=form.querySelector('input[name="category_id"]')?.value||'';
 const found=resolveCategoryVariations(categories,categoryId);
 const options=found.options;
 const chips=picker.querySelector('.size-chip-group');
 const list=picker.querySelector('.size-variant-list');
 if(!chips||!list)return;
 chips.innerHTML='';list.innerHTML=makeVariationCards(options,gondolas);
 list.querySelectorAll('input,select').forEach(input=>input.disabled=!options.length);
 const toggle=form.querySelector('[data-use-sizes]');
 if(toggle){
  toggle.disabled=!options.length;toggle.checked=Boolean(options.length);
  if(!options.length&&toggle.checked){toggle.checked=false;toggle.dispatchEvent(new Event('change',{bubbles:true}));}
 }
 const caption=form.querySelector('[data-variation-selection-caption]');
 if(caption)caption.textContent=options.length?
  options.join(' · ')+(found.inherited?' (herdadas)':''):
  'Selecione uma categoria com variações configuradas para ativar esta opção.';
 const single=form.querySelector('[data-single-fields]');
 if(single){single.hidden=Boolean(options.length);single.querySelectorAll('input').forEach(input=>input.disabled=Boolean(options.length));}
 const amount=form.querySelector('[data-single-stock]');
 if(amount){amount.hidden=Boolean(options.length);amount.querySelectorAll('input').forEach(input=>input.disabled=Boolean(options.length));}
}
export function getVariationChoices(form){
 return [...(form?.querySelectorAll('[data-action="size-toggle"]')||[])].map(el=>el.dataset.size);
}
