import {makeVariationCards,makeVariationChips,resolveCategoryVariations} from './category-variations.js?v=20261015variants1';
// Cadastro único de produtos: variações de roupas sem outra seção de navegação.
export const STANDARD_SIZES=['P','M','G','GG','XGG','XXGG','EXGG'];
const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function sizeCard(size){
  return '<div class="size-variant-card" data-size-variant="'+size+'" hidden>'+
    '<div class="size-variant-heading"><strong>Tamanho '+size+'</strong>'+
    '<button type="button" class="button small" data-action="size-remove" data-size="'+size+'">Remover</button></div>'+
    '<div class="size-fields">'+
    '<label class="field"><span>Código interno (SKU)</span><input name="size_sku" maxlength="80" disabled autocomplete="off" placeholder="Gerado automaticamente se vazio"></label>'+
    '<label class="field"><span>EAN (se houver)</span><div class="inline apparel-ean"><input name="size_ean" maxlength="14" inputmode="numeric" disabled placeholder="Código de barras">'+
    '<button class="button small" type="button" data-action="size-scan" aria-label="Ler EAN do tamanho '+size+'">📷</button></div></label>'+
    '<label class="field"><span>Estoque inicial *</span><input name="size_qty" type="number" step="1" min="0" max="1000000" value="0" disabled required inputmode="numeric"></label>'+
    '</div></div>';
}
export function sizesSection(){
 return '<section class="form-section wide variant-switch-section">'+
  '<label class="variation-switch"><input type="checkbox" name="use_sizes" data-use-sizes disabled>'+
  '<span class="variation-switch-indicator"></span><span><strong>Cadastrar variações?</strong>'+
  '<small data-variation-selection-caption>Escolha a categoria para ver as variações disponíveis.</small></span></label>'+
  '<div data-variant-panel hidden>'+
  '<div class="size-common-fields">'+
   '<label class="field"><span>Tipo do produto</span><select name="apparel_type" disabled>'+
    ['Outro','Camiseta','Camisa','Polo','Blusa','Vestido','Casaco'].map(x=>'<option>'+x+'</option>').join('')+'</select></label>'+
   '<label class="field"><span>Público (opcional para identificação)</span><select name="apparel_audience" disabled>'+
    ['Unissex','Feminino','Masculino'].map(x=>'<option>'+x+'</option>').join('')+'</select></label>'+
   '<label class="field"><span>Faixa etária</span><select name="apparel_age" disabled>'+
    ['Adulto','Infantil','Bebê'].map(x=>'<option>'+x+'</option>').join('')+'</select></label></div>'+
  '<div class="size-selector-title"><strong>Escolha as variações disponíveis</strong>'+
   '<button type="button" class="button small" data-action="size-common" disabled>Selecionar primeiras 4</button></div>'+
  '<div class="size-chip-group" role="group" aria-label="Variações para cadastrar"></div>'+
  '<div class="size-variant-list"></div>'+
  '<p class="help">Cada variação terá SKU, EAN e saldo independente. Os nomes vêm da categoria e podem ser editados em Categorias.</p>'+
  '</div></section>';
}
export function setSizesMode(form,checked){
  const panel=form?.querySelector('[data-variant-panel]');
  if(!panel)return;
  panel.hidden=!checked;
  panel.querySelectorAll('[name="apparel_type"],[name="apparel_audience"],[name="apparel_age"]')
    .forEach(input=>input.disabled=!checked);
  for(const row of panel.querySelectorAll('[data-size-variant]')){
    const enabled=checked&&!row.hidden;
    row.querySelectorAll('input').forEach(input=>input.disabled=!enabled);
  }
  const single=form.querySelector('[data-single-fields]');
  if(single){
    single.hidden=checked;
    single.querySelectorAll('input').forEach(input=>input.disabled=checked);
  }
  const amount=form.querySelector('[data-single-stock]');
  if(amount){amount.hidden=checked;amount.querySelectorAll('input').forEach(input=>input.disabled=checked);}
  const submit=form.querySelector('.modalfooter [type="submit"]');
  if(submit)submit.textContent=checked?'Cadastrar tamanhos':'Cadastrar produto';
}
export function setSizeSelected(form,size,enabled){
  const row=[...form.querySelectorAll('[data-size-variant]')].find(el=>el.dataset.sizeVariant===size);
  const chip=[...form.querySelectorAll('[data-action="size-toggle"]')].find(el=>el.dataset.size===size);
  if(!row||!chip)return;
  row.hidden=!enabled;
  chip.classList.toggle('selected',enabled);
  chip.setAttribute('aria-pressed',String(enabled));
  row.querySelectorAll('input').forEach(input=>input.disabled=!enabled);

}
export function collectSizeVariants(form){
  const color='Única'; // Campo Cor foi removido. O banco mantém o identificador técnico.
  const rows=[...form.querySelectorAll('[data-size-variant]')].filter(x=>!x.hidden);
  if(!rows.length)throw new Error('Selecione pelo menos um tamanho.');
  const usedSkus=new Set(),usedEans=new Set();
  return rows.map(row=>{
    const get=n=>row.querySelector('[name="'+n+'"]')?.value?.trim()||'';
    const size=row.dataset.sizeVariant;
    const sku=get('size_sku'),ean=get('size_ean').replace(/[\s-]/g,'');
    const text=get('size_qty'),quantity=Number(text);
    if(sku.length>80)throw new Error('SKU do tamanho '+size+' é longo demais.');
    if(sku&&usedSkus.has(sku.toLocaleUpperCase('pt-BR')))
      throw new Error('O SKU "'+sku+'" foi repetido em dois tamanhos. Deixe vazio para gerar automaticamente.');
    if(sku)usedSkus.add(sku.toLocaleUpperCase('pt-BR'));
    if(ean&&usedEans.has(ean))
      throw new Error('O EAN "'+ean+'" foi repetido em dois tamanhos. Cada código deve identificar apenas uma variação.');
    if(ean)usedEans.add(ean);
    if(ean&&!/^[0-9]{8,14}$/.test(ean))throw new Error('EAN inválido no tamanho '+size+'.');
    if(text===''||!Number.isInteger(quantity)||quantity<0||quantity>1000000)
      throw new Error('Estoque inválido no tamanho '+size+'.');
    return {size,color,sku,ean:ean||null,quantity};
  });
}
export async function saveSizedProduct(form,{db,assertOk,state,categoryChain,chosenCategory,productTagValues,closeTopModal,loadData,toast,saveGallery,saveProcurement}){
  const name=form.elements.namedItem('name')?.value?.trim()||'';
  if(name.length<2||name.length>110)throw new Error('Informe o nome do produto (2 a 110 caracteres).');
  const category=chosenCategory(form);
  if(!category)throw new Error('Escolha uma categoria para este produto.');
  const allowed=resolveCategoryVariations(state.categories,category).options;
  if(!allowed.length)throw new Error('Configure as variações desta categoria em Categorias.');
  const variants=collectSizeVariants(form);
  if(variants.some(v=>!allowed.some(label=>label.toLocaleLowerCase('pt-BR')===v.size.toLocaleLowerCase('pt-BR'))))
   throw new Error('Alguma variação escolhida não pertence à categoria atual. Confira os tamanhos.');
  // Antecipar conflitos para exibir a causa e preservar todo o preenchimento.
  const providedSkus=variants.map(x=>x.sku).filter(Boolean);
  const providedEans=variants.map(x=>x.ean).filter(Boolean);
  if(providedSkus.length){
    const check=assertOk(await db.from('products').select('sku').in('sku',providedSkus).eq('active',true).limit(100))||[];
    if(check.length)throw new Error('O SKU "'+check[0].sku+'" está em uso por outro produto ativo. Informe outro código ou deixe vazio para gerar automaticamente.');
  }
  if(providedEans.length){
    const check=assertOk(await db.from('products').select('ean').in('ean',providedEans).eq('active',true).limit(100))||[];
    if(check.length)throw new Error('O EAN "'+check[0].ean+'" está em uso por outro produto ativo. Confira a etiqueta desse tamanho.');
  }
  const v=n=>form.elements.namedItem(n)?.value?.trim()||'';
  const hasGallery=Boolean(form.querySelector('[data-gallery]'));
  let id;
  try{
    id=assertOk(await db.rpc('create_apparel_with_location',{
      p_name:name,p_type:v('apparel_type'),p_audience:v('apparel_audience'),
      p_age_group:v('apparel_age'),p_category_id:category,p_tags:productTagValues(form),
      p_variants:variants,p_gondola:v('gondola'),p_prateleira:v('prateleira')
    }));
  }catch(error){
    if(error?.code==='23505'&&/products_(?:active_sku_unique|sku_key)/.test((error.message||'')+' '+(error.details||'')))
      throw new Error('Código interno já utilizado por outro produto ativo. Troque o SKU ou deixe vazio para gerar automaticamente.');
    if(error?.code==='23505'&&/products_(?:active_ean_unique|ean_key)/.test((error.message||'')+' '+(error.details||'')))
      throw new Error('EAN duplicado. Confira os códigos das etiquetas dos tamanhos selecionados.');
    throw error;
  }
  if(saveProcurement)await saveProcurement(id,form);
  let photoWarning=false;
  if(hasGallery){
   try{await saveGallery(form,{db,assertOk,modelId:id});}
   catch(error){photoWarning=true;console.error('Fotos pendentes após criar variações',error);}
  }
  state.view='produtos';state.search=name;state.page=0;
  closeTopModal();
  await loadData();
  toast(photoWarning?'Tamanhos cadastrados. Foto pendente.':'Produto com '+variants.length+' tamanho(s) cadastrado.');
}
