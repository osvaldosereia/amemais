// AME MAIS — cadastro simplificado de roupas; variações são produtos reais do estoque.
const types=['Camiseta','Camisa','Polo','Blusa','Vestido','Casaco','Outro'];
const audiences=['Unissex','Feminino','Masculino'];
const ages=['Adulto','Infantil','Bebê'];
const sizes=['PP','P','M','G','GG','XG','XXG','XXXG','Único','2','4','6','8','10','12','14','16'];

const select = (name, title, options, value) =>
  '<label class="field"><span>'+title+'</span><select name="'+name+'" required>'+
  options.map(o=>'<option value="'+o+'" '+(o===value?'selected':'')+'>'+o+'</option>').join('')+'</select></label>';

export function apparelRowHTML(h,defaultColor='',initial=false){
  const opts='<option value="">Tamanho</option>'+
    sizes.map(x=>'<option value="'+x+'" '+(initial&&x==='M'?'selected':'')+'>'+x+'</option>').join('');
  return '<div class="apparel-variant" data-apparel-row>'+
    '<div class="apparel-variant-head"><strong>Variação</strong>'+
    '<button type="button" class="button small" data-action="apparel-remove-row">Remover</button></div>'+
    '<div class="apparel-variant-grid">'+
    '<label class="field"><span>Cor *</span><input name="variant_color" maxlength="40" required value="'+h(defaultColor)+'" placeholder="Ex.: Branco" /></label>'+
    '<label class="field"><span>Tamanho *</span><select name="variant_size" required>'+opts+'</select></label>'+
    '<label class="field"><span>SKU (opcional)</span><input name="variant_sku" maxlength="80" placeholder="Ex.: CAM-NS-M" /></label>'+
    '<label class="field"><span>EAN (opcional)</span><div class="inline apparel-ean">'+
    '<input name="variant_ean" data-variant-ean inputmode="numeric" maxlength="18" placeholder="Código de barras" />'+
    '<button type="button" class="button small" data-action="apparel-scan">📷</button></div></label>'+
    '<label class="field"><span>Estoque inicial na loja *</span><input name="variant_qty" inputmode="numeric" type="number" min="0" max="1000000" step="1" required value="0" /></label>'+
    '</div></div>';
}

export function apparelPage(state,{h,tabHead,button,qtyStore,photoButton}){
  const models=state.apparelModels||[];
  const records=models.map(m=>{
    const vars=state.items.filter(p=>p.apparel_model_id===m.id);
    const total=vars.reduce((sum,p)=>sum+qtyStore(p.id),0);
    const open=state.apparelOpen?.has(m.id);
    const thumb=vars.find(p=>p.image_path);
    const image=thumb?photoButton(thumb):
      '<div class="apparel-no-photo" aria-hidden="true">▧</div>';
    const body=open?'<div class="apparel-variants-list">'+
      (vars.length?vars.map(p=>'<div class="apparel-detail-variant">'+
       '<div><strong>'+h(p.apparel_color)+' · '+h(p.apparel_size)+'</strong>'+
       '<small>'+h(p.sku||'Sem SKU')+' · '+h(p.ean||'Sem EAN')+'</small></div>'+
       '<div class="apparel-detail-right"><span>'+qtyStore(p.id)+' un.</span>'+
       button('Editar','apparel-variant-edit','data-id="'+h(p.id)+'"','small')+
       button('Abrir produto','apparel-product','data-id="'+h(p.id)+'"','small')+'</div></div>').join(''):
       '<div class="muteblock">Nenhuma variação encontrada.</div>')+
      '</div>':'';
    return '<article class="apparel-model-card">'+
      '<div class="apparel-model-main">'+image+
      '<div class="apparel-model-info"><strong>'+h(m.name)+'</strong>'+
      '<small>'+h(m.garment_type)+' · '+h(m.age_group)+' · '+h(m.audience)+'</small>'+
      '<div class="apparel-model-meta"><span>'+vars.length+' variação(ões)</span><span>'+total+' unidades na loja</span></div></div>'+
      '<div class="apparel-card-actions">'+button('Foto','apparel-photo','data-id="'+h(m.id)+'"','small')+
      button(open?'Recolher':'Ver tamanhos','apparel-expand','data-id="'+h(m.id)+'"','small')+'</div>'+
      '</div>'+body+'</article>';
  }).join('');
  return tabHead('Roupas','Cadastre um modelo e controle cada tamanho e cor separadamente.',
    button('+ Nova roupa','apparel-new','','primary'))+
    '<section class="apparel-help"><strong>Como funciona</strong><p>Exemplo: Camiseta Nossa Senhora · cor Branca · tamanhos P, M, G. Cada tamanho possui SKU, EAN e estoque próprios. No evento e no balanço, cada variação é movimentada separadamente.</p>'+
    '<p class="help">O exemplo acima é apenas uma orientação. Nenhuma roupa fictícia é cadastrada automaticamente.</p></section>'+
    '<div class="apparel-model-list">'+
    (records||'<div class="apparel-empty"><strong>Nenhuma roupa cadastrada.</strong><p>Toque em Nova roupa para cadastrar o primeiro modelo e os tamanhos disponíveis.</p></div>')+
    '</div>';
}

export function apparelModal(state,{h,formModal,photoChooser,categorySelector,productTagChooser,procurementFields}){
  const root=state.categories.find(c=>!c.parent_id&&c.name.toLocaleLowerCase('pt-BR')==='roupas');
  if(!root)throw new Error('Cadastre primeiro a categoria principal Roupas.');
  const initialCategory=state.categories.find(c=>c.parent_id===root.id&&c.name.toLocaleLowerCase('pt-BR')==='camisetas')||root;
  const inner='<div class="apparel-form">'+
    '<section class="form-section"><div class="section-head"><strong>1. Modelo da roupa</strong></div>'+
    '<div class="formgrid">'+
    '<label class="field wide"><span>Nome da roupa *</span><input name="apparel_name" maxlength="110" minlength="2" placeholder="Ex.: Camiseta Nossa Senhora Aparecida" required /></label>'+
    select('apparel_type','Tipo de roupa',types,'Camiseta')+
    select('apparel_age','Faixa etária',ages,'Adulto')+
    select('apparel_audience','Público',audiences,'Unissex')+
    '</div></section>'+
    categorySelector({category_id:initialCategory.id})+
    photoChooser(null)+productTagChooser(null)+procurementFields(null)+
    '<section class="form-section wide"><div class="section-head"><strong>2. Tamanhos, cores e quantidades</strong></div>'+
    '<p class="help">Cada combinação de cor e tamanho é uma variação independente. Comece por uma e toque em Adicionar variação para incluir outras.</p>'+
    '<div data-apparel-rows>'+apparelRowHTML(h,'Branco',true)+'</div>'+
    '<div class="apparel-add-actions"><button type="button" class="button apparel-add" data-action="apparel-add-row">+ Adicionar variação</button>'+    '<button type="button" class="button" data-action="apparel-fill-sizes">Preencher P, M, G e GG</button></div>'+
    '</section>'+
    '<div class="note">A quantidade inicial será registrada no histórico. As futuras transferências, vendas e devoluções serão controladas por tamanho e cor.</div>'+
    '</div>';
  formModal('Nova roupa · cadastro básico',inner,'apparel-create','Cadastrar roupa');
}

export function apparelAddRow(target,{h}){
  const form=target.closest('form');
  const container=form?.querySelector('[data-apparel-rows]');
  if(!container)return;
  if(container.querySelectorAll('[data-apparel-row]').length>=40)
    throw new Error('São permitidas até 40 variações por modelo.');
  const last=[...container.querySelectorAll('[data-apparel-row]')].at(-1);
  const color=last?.querySelector('[name="variant_color"]')?.value?.trim()||'Branco';
  container.insertAdjacentHTML('beforeend',apparelRowHTML(h,color,false));
  container.lastElementChild?.querySelector('select[name="variant_size"]')?.focus();
}

export function apparelRemoveRow(target){
  const row=target.closest('[data-apparel-row]'),container=row?.parentElement;
  if(!row||!container)return;
  if(container.querySelectorAll('[data-apparel-row]').length===1)
    throw new Error('Mantenha pelo menos uma variação.');
  row.remove();
}

function validatedVariants(form){
  const seen=new Set();
  return [...form.querySelectorAll('[data-apparel-row]')].map(row=>{
    const get=name=>row.querySelector('[name="'+name+'"]')?.value?.trim()||'';
    const color=get('variant_color'),size=get('variant_size'),
      sku=get('variant_sku'),ean=get('variant_ean').replace(/[\s-]/g,'');
    const raw=get('variant_qty'),quantity=Number(raw);
    if(color.length<2||color.length>40||!size||size.length>16)
      throw new Error('Informe cor e tamanho de todas as variações.');
    if(ean&&!/^[0-9]{8,14}$/.test(ean))
      throw new Error('EAN inválido em '+color+' / '+size+'. Use de 8 a 14 dígitos.');
    if(raw===''||!Number.isInteger(quantity)||quantity<0||quantity>1000000)
      throw new Error('Quantidade inválida em '+color+' / '+size+'.');
    const key=color.toLocaleLowerCase('pt-BR')+'|'+size.toUpperCase();
    if(seen.has(key))throw new Error('Cor e tamanho repetidos: '+color+' / '+size+'.');
    seen.add(key);
    return {color,size,sku:sku||null,ean:ean||null,quantity};
  });
}

export async function submitApparel(form,{
 state,db,assertOk,chosenCategory,productTagValues,loadData,closeTopModal,toast,saveGallery,saveProcurement
}){
  const name=form.elements.namedItem('apparel_name')?.value?.trim()||'';
  if(name.length<2||name.length>110)throw new Error('Informe um nome de 2 a 110 caracteres.');
  const category=chosenCategory(form);
  if(!category)throw new Error('Selecione uma categoria de Roupas.');
  const variants=validatedVariants(form);
  if(!variants.length)throw new Error('Adicione pelo menos uma variação.');
  const hasGallery=Boolean(form.querySelector('[data-gallery]'));
  const created=assertOk(await db.rpc('create_apparel',{
    p_name:name,
    p_type:form.elements.namedItem('apparel_type').value,
    p_age_group:form.elements.namedItem('apparel_age').value,
    p_audience:form.elements.namedItem('apparel_audience').value,
    p_category_id:category,
    p_tags:productTagValues(form),
    p_variants:variants
  }));
  await saveProcurement(created,form);
  let photoWarning=false;
  if(hasGallery){
   try{await saveGallery(form,{db,assertOk,modelId:created});}
   catch(error){photoWarning=true;console.error('Fotos pendentes',error);}
  }
  state.apparelOpen.add(created);
  state.view='roupas';
  closeTopModal();
  await loadData();
  toast(photoWarning?'Roupa cadastrada. A foto não foi salva; é possível adicioná-la posteriormente.':'Roupa cadastrada com todas as variações.');
}


export function apparelFillSizes(target,{h}){
  const form=target.closest('form'),rows=form?.querySelector('[data-apparel-rows]');
  if(!rows)return;
  const current=[...rows.querySelectorAll('[data-apparel-row]')];
  const color=current[0]?.querySelector('[name="variant_color"]')?.value?.trim()||'Branco';
  const existing=new Set();
  for(const row of current){
    const rowColor=row.querySelector('[name="variant_color"]')?.value?.trim()?.toLocaleLowerCase('pt-BR');
    const size=row.querySelector('[name="variant_size"]')?.value;
    if(rowColor===color.toLocaleLowerCase('pt-BR')&&size)existing.add(size);
  }
  for(const size of ['P','M','G','GG']){
    if(existing.has(size))continue;
    const empty=current.find(row=>!row.querySelector('[name="variant_size"]')?.value);
    const row=empty||(()=>{
      if(rows.querySelectorAll('[data-apparel-row]').length>=40)throw new Error('Limite de 40 variações.');
      rows.insertAdjacentHTML('beforeend',apparelRowHTML(h,color,false));
      return rows.lastElementChild;
    })();
    row.querySelector('[name="variant_color"]').value=color;
    row.querySelector('[name="variant_size"]').value=size;
    existing.add(size);
    const pos=current.indexOf(row);
    if(pos>=0)current.splice(pos,1);
  }
}

export function apparelVariantEditModal(p,{h,formModal,variationOptions=[],procurementFields}){
  if(!p?.apparel_model_id)throw new Error('Variação inválida.');
  const configured=variationOptions.length?variationOptions:[p.apparel_size];
  const sizeOptions='<option value="">Variação</option>'+
    configured.concat(configured.includes(p.apparel_size)?[]:[p.apparel_size]).map(v=>
      '<option value="'+h(v)+'" '+(v===p.apparel_size?'selected':'')+'>'+h(v)+'</option>').join('');
  formModal('Editar variação · '+p.name,
    '<div class="formgrid">'+
    '<input type="hidden" name="color" value="'+h(p.apparel_color||'Única')+'">'+
    '<label class="field"><span>Variação</span><select name="size" required>'+sizeOptions+'</select></label>'+
    '<label class="field"><span>SKU</span><input name="sku" maxlength="80" value="'+h(p.sku||'')+'"></label>'+
    '<label class="field"><span>EAN</span><div class="inline apparel-ean"><input name="ean" data-variant-ean inputmode="numeric" maxlength="18" value="'+h(p.ean||'')+'">'+
    '<button type="button" class="button small" data-action="apparel-scan">📷</button></div></label>'+
    '<label class="field"><span>Gôndola</span><input name="gondola" maxlength="40" value="'+h(p.gondola||'')+'"></label>'+
    '<label class="field"><span>Prateleira</span><input name="prateleira" maxlength="40" value="'+h(p.prateleira||'')+'"></label>'+
    procurementFields(p)+
     '<label class="field"><span>Situação</span><select name="active"><option value="true" '+(p.active?'selected':'')+'>Ativa</option>'+
    '<option value="false" '+(!p.active?'selected':'')+'>Inativa</option></select></label>'+
    '</div><div class="note">Esta edição não altera saldos. Para conferir o estoque livre, abra os tamanhos no card do produto.</div>',
    'apparel-edit-variant','Salvar variação');
  const form=document.querySelector('.modalback form[data-form="apparel-edit-variant"]');
  if(form)form.dataset.productId=p.id;
}

export async function saveApparelVariant(form,{db,assertOk,loadData,closeTopModal,toast,procurementValues}){
  const v=name=>form.elements.namedItem(name)?.value?.trim()||'';
  const color=v('color'),size=v('size'),sku=v('sku'),ean=v('ean').replace(/[\s-]/g,'');
  if(color.length<2||color.length>40||!size)throw new Error('Variação inválida.');
  if(ean&&!/^[0-9]{8,14}$/.test(ean))throw new Error('EAN precisa de 8 a 14 dígitos.');
  assertOk(await db.rpc('update_apparel_variant',{
    p_product_id:form.dataset.productId,p_color:color,p_size:size,
    p_sku:sku||null,p_ean:ean||null,p_active:v('active')==='true'
  }));
  assertOk(await db.from('products').update({
    gondola:v('gondola')||null,prateleira:v('prateleira')||null,...procurementValues(form)
  }).eq('id',form.dataset.productId));
  closeTopModal();
  await loadData();
  toast('Variação atualizada sem alterar estoque.');
}

export function apparelPhotoModal(model,state,{formModal,photoChooser,hydrateImages}){
  if(!model)throw new Error('Modelo de roupa não encontrado.');
  const variant=state.items.find(p=>p.apparel_model_id===model.id);
  formModal('Foto · '+model.name,photoChooser(
    {...model,id:variant?.id||model.id}
  ),'apparel-photo','Salvar foto');
  const form=document.querySelector('.modalback form[data-form="apparel-photo"]');
  if(form)form.dataset.modelId=model.id;
  hydrateImages();
}

export async function saveApparelPhoto(form,{db,assertOk,loadData,closeTopModal,toast,saveGallery}){
 const id=form.dataset.modelId;
 await saveGallery(form,{db,assertOk,modelId:id});
 closeTopModal();await loadData();toast('Galeria atualizada para todas as variações.');
}

export function apparelSyncCategory(select,state,{categoryFull}){
  const form=select.closest('form[data-form="apparel-create"]');if(!form)return;
  const root=state.categories.find(c=>!c.parent_id&&c.name.toLocaleLowerCase('pt-BR')==='roupas');
  if(!root)return;
  const map={Camiseta:'Camisetas',Camisa:'Camisas',Polo:'Polos',Blusa:'Blusas',
    Vestido:'Vestidos',Casaco:'Casacos',Outro:'Outras roupas'};
  const targetName=map[select.value];
  const target=state.categories.find(c=>c.parent_id===root.id&&c.name===targetName);
  const input=form.querySelector('input[name="category_id"]');
  const current=state.categories.find(c=>c.id===input?.value);
  // Não substitui uma subcategoria específica escolhida manualmente.
  const standard=new Set(Object.values(map));
  if(!target||!input||current?.parent_id!==root.id&&current?.id!==root.id)return;
  if(current?.id!==root.id&&!standard.has(current.name))return;
  input.value=target.id;
  const label=form.querySelector('[data-category-label]');
  if(label)label.textContent=categoryFull(target.id);
}
