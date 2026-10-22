// Uma lista compacta das variações definidas na categoria.
// Campos ainda não cadastrados: estoque zero, EAN e SKU vazios.
// Nenhum código ou saldo é gerado até o salvamento explícito.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const variationKey=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .trim().replace(/^tamanho\s+/i,'').replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
export function uniqueCategoryVariations(options=[]){
 const seen=new Set();
 return options.filter(label=>{
   const key=variationKey(label);if(!key||seen.has(key))return false;
   seen.add(key);return true;
 });
}
const editableInput=(name,value,extra='',disabled=false)=>
 '<input name="'+name+'" value="'+esc(value)+'" '+extra+(disabled?' disabled':'')+'>';
export function variationFormHTML(options=[],products=[],{
 isModel=false,canEdit=false,main=null,modelId=null,physicalFor=()=>0
}={}){
 const choices=uniqueCategoryVariations(options),bySize=new Map();
 for(const p of products){
  if(!p||p.force_archived_at||!p.apparel_size)continue;
  const key=variationKey(p.apparel_size);
  if(!bySize.has(key)||(!bySize.get(key).active&&p.active))bySize.set(key,p);
 }
 if(!choices.length)return '<p class="variation-compact-empty">Esta categoria não possui variações definidas. Configure os tamanhos em Categorias.</p>';
 const group=choices.map(label=>{
  const existing=isModel?bySize.get(variationKey(label)):null;
  const inactive=Boolean(existing&&!existing.active);
  const stock=existing?Number(physicalFor(existing.id)||0):0;
  const disabled=!canEdit||inactive;
  const input=(title,name,value,attrs='')=>
   '<label class="variation-compact-field"><span>'+title+'</span>'+
    editableInput(name,value,attrs,disabled)+'</label>';
  const badge=existing?'<small class="variation-compact-badge '+(inactive?'is-inactive':'is-registered')+'">'+
     (inactive?'Inativa':'Cadastrada')+'</small>':'';
  const originalPick=!isModel&&canEdit?
   '<label class="variation-compact-legacy-pick"><input type="radio" name="original_size" value="'+esc(label)+
   '" data-original-size> SKU atual</label>':'';
  return '<div class="variation-compact-row" data-variation-row data-size="'+esc(label)+'" '+
   'data-id="'+esc(existing?.id||'')+'" data-status="'+(inactive?'inactive':existing?'registered':'new')+'" '+
   'data-expected-quantity="'+esc(stock)+'" data-expected-sku="'+esc(existing?.sku||'')+'" '+
   'data-expected-ean="'+esc(existing?.ean||'')+'">'+
   '<div class="variation-compact-title"><strong>'+esc(label)+'</strong>'+badge+originalPick+'</div>'+
   '<div class="variation-compact-fields">'+
     input('Estoque','quantity',stock,'type="number" min="0" max="1000000" step="1" inputmode="numeric"')+
     input('EAN','ean',existing?.ean||'','inputmode="numeric" maxlength="14" placeholder="Código de barras"')+
     input('SKU','sku',existing?.sku||'','maxlength="80" placeholder="Código interno"')+
   '</div></div>';
 }).join('');
 const outside=products.filter(p=>p.apparel_size&&!choices.some(s=>variationKey(s)===variationKey(p.apparel_size)));
 return '<form data-form="product-variation-table" class="variation-compact-form" '+
   'data-is-model="'+String(isModel)+'" data-model-id="'+esc(modelId||'')+
   '" data-id="'+esc(main?.id||'')+'" data-unsaved="false" '+
   'data-original-id="'+esc(!isModel?main?.id||'':'')+'" '+
   'data-original-sku="'+esc(!isModel?main?.sku||'':'')+
   '" data-original-ean="'+esc(!isModel?main?.ean||'':'')+
   '" data-original-quantity="'+esc(!isModel?physicalFor(main?.id):0)+'">'+
   '<div class="variation-compact-header"><strong>Variações da categoria</strong>'+
      '<small>'+choices.length+' tamanhos · preencha diretamente</small></div>'+
   (!isModel?'<p class="variation-compact-help">Produto antigo com SKU '+esc(main?.sku||'—')+
    ': marque a qual tamanho ele pertence. O estoque e os códigos originais serão preservados.</p>':
    '<p class="variation-compact-help">Tamanhos novos começam com estoque 0 e códigos vazios. Preencha apenas o necessário.</p>')+
   '<div class="variation-compact-list">'+group+'</div>'+
   (outside.length?'<p class="variation-compact-help">Variações antigas preservadas: '+
     esc(outside.map(p=>p.apparel_size).join(' · '))+'</p>':'')+
   '</form>';
}
export function readVariationForm(form){
 if(!form)return {originalSize:'',rows:[]};
 const originalSize=form.querySelector('[data-original-size]:checked')?.value||'';
 const rows=[...form.querySelectorAll('[data-variation-row]')].filter(row=>row.dataset.status!=='inactive')
  .map(row=>({
   size:row.dataset.size,
   id:row.dataset.id||null,
   sku:row.querySelector('[name="sku"]')?.value.trim()||'',
   ean:row.querySelector('[name="ean"]')?.value.trim()||'',
   quantity:row.querySelector('[name="quantity"]')?.value.trim()||'',
   expected_quantity:Number(row.dataset.expectedQuantity||0),
   expected_sku:row.dataset.expectedSku||'',
   expected_ean:row.dataset.expectedEan||''
  }));
 const codes=new Set();
 for(const row of rows){
  if(!/^\d{1,7}$/.test(row.quantity)||Number(row.quantity)>1000000)
   throw new Error('Estoque inválido para '+row.size+'. Informe de 0 a 1.000.000.');
  if(row.sku.length>80)throw new Error('SKU muito longo em '+row.size+'.');
  if(row.ean&&!/^\d{8,14}$/.test(row.ean.replace(/[\s-]/g,'')))
   throw new Error('EAN inválido em '+row.size+'. Use de 8 a 14 dígitos.');
  for(const value of [row.sku&&'SKU:'+row.sku.toLowerCase(),
   row.ean&&'EAN:'+row.ean.replace(/[\s-]/g,'')]){
    if(!value)continue;
    if(codes.has(value))throw new Error('Código repetido entre tamanhos: '+value.split(':')[1]);
    codes.add(value);
  }
 }
 const changed=rows.some(row=>
  row.sku!==(row.expected_sku||'')||
  row.ean!==(row.expected_ean||'')||
  Number(row.quantity)!==row.expected_quantity);
 if(form.dataset.isModel!=='true'&&changed&&!originalSize)
  throw new Error('Marque qual tamanho corresponde ao SKU já existente.');
 return {originalSize,rows};
}
export function useOriginalVariation(form,size){
 if(!form||form.dataset.isModel==='true')return;
 const mainSku=form.dataset.originalSku||'',mainEan=form.dataset.originalEan||'';
 const mainQty=String(Number(form.dataset.originalQuantity||0));
 for(const row of form.querySelectorAll('[data-variation-row]')){
  const isOriginal=row.dataset.size===size;
  const originalInput=row.querySelector('[data-original-size]');
  if(originalInput)originalInput.checked=isOriginal;
  // Guardar rascunhos dos demais tamanhos ao trocar a escolha do tamanho legado.
  if(!isOriginal){
    if(row.dataset.originalApplied==='true'){
      for(const field of ['sku','ean','quantity']){
       const el=row.querySelector('[name="'+field+'"]');
       if(el)el.value=row.dataset['draft'+field.charAt(0).toUpperCase()+field.slice(1)]|| (field==='quantity'?'0':'');
      }
      row.dataset.id='';row.dataset.expectedSku='';row.dataset.expectedEan='';row.dataset.expectedQuantity='0';
      row.dataset.originalApplied='false';
    }
    continue;
  }
  if(row.dataset.originalApplied==='true')continue;
  row.dataset.id=form.dataset.originalId||'';
  row.dataset.expectedSku=mainSku;row.dataset.expectedEan=mainEan;
  row.dataset.expectedQuantity=mainQty;
  for(const [field,value] of [['sku',mainSku],['ean',mainEan],['quantity',mainQty]]){
   const input=row.querySelector('[name="'+field+'"]');
   if(!input)continue;
   row.dataset['draft'+field.charAt(0).toUpperCase()+field.slice(1)]=input.value;
   input.value=value;
  }
  row.dataset.originalApplied='true';
 }
 form.dataset.unsaved='true';
}
