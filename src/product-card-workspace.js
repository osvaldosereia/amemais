// CDSB: edição contextual no próprio card. Apenas campos já existentes em products/apparel_models.
import {resolveCategoryVariations} from './category-variations.js?v=20261016gondolas1';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const order=['PP','P','M','G','GG','XGG','XXGG','EXGG'];
function rank(value){
 const v=String(value||'').toUpperCase().replace(/^TAMANHO\s+/,'');
 const at=order.indexOf(v);
 return at<0?1000+(Number(v)||500):at;
}
export function categoryPath(categories,id){
 const byId=new Map(categories.map(c=>[c.id,c]));
 const visited=new Set(),parts=[];
 while(id&&!visited.has(id)&&parts.length<10){
  visited.add(id);const category=byId.get(id);if(!category)break;
  parts.unshift(category.name);id=category.parent_id;
 }
 return parts.join(' › ');
}
// Só folhas são selecionáveis. A categoria intermediária atual permanece
// como exceção para não quebrar cadastros antigos durante a edição.
export function selectableProductCategories(categories,currentId=null){
 const parents=new Set(categories.map(c=>c.parent_id).filter(Boolean));
 return categories.filter(c=>!parents.has(c.id)||c.id===currentId)
  .map(c=>({
    id:c.id,
    label:categoryPath(categories,c.id)+(parents.has(c.id)?' (categoria geral atual)':''),
    currentParent:parents.has(c.id)
  }))
  .sort((a,b)=>a.label.localeCompare(b.label,'pt-BR',{numeric:true,sensitivity:'base'}));
}
const normalizeCategorySearch=value=>String(value??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export function filterProductCategories(options,query){
 const terms=normalizeCategorySearch(query).split(/\s+/).filter(Boolean);
 if(!terms.length)return options.slice();
 return options.filter(opt=>{
   const searchable=normalizeCategorySearch(opt.label);
   return terms.every(term=>searchable.includes(term));
 });
}
const button=(label,attr='',kind='')=>'<button type="button" class="button small '+kind+'" '+attr+'>'+safe(label)+'</button>';
const save=label=>'<div class="cdsb-edit-footer"><button type="submit" class="button primary">'+label+'</button></div>';
const dropdown=(name,items,current)=>'<select name="'+name+'">'+items.map(([value,label])=>
 '<option value="'+safe(value)+'"'+(String(value)===String(current??'')?' selected':'')+'>'+safe(label)+'</option>').join('')+'</select>';
const input=(label,name,value,attrs='')=>'<label>'+safe(label)+'<input name="'+name+'" value="'+safe(value??'')+'" '+attrs+'></label>';
function skuPicker(products,selected){
 return '<label class="cdsb-edit-sku-picker">Variação / SKU'+dropdown('sku-selector',
 products.map(p=>[p.id,(p.apparel_size||'Único')+' · '+(p.sku||'sem SKU')]),selected)+'</label>';
}
function subpanel(group,sku,tab,visible,body){
 return '<div data-edit-sku-panel="'+safe(sku.id)+'" data-edit-sku-tab="'+tab+'"'+(visible?'':' hidden')+'>'+
 '<form data-form="product-card-'+tab+'" data-id="'+safe(sku.id)+'" data-model-id="'+safe(group.modelId||'')+'">'+body+'</form></div>';
}
function currentSku(products,selected){return products.find(p=>p.id===selected)||products[0];}
export function productCardWorkspace(group,{
 categories=[],suppliers=[],gondolas=[],canDeleteWholeModel=false,canDeleteProduct=false,ui=null
}={}){
 const model=group.model,main=group.main,products=group.products.slice().sort((a,b)=>
 rank(a.apparel_size)-rank(b.apparel_size)||String(a.apparel_size||'').localeCompare(String(b.apparel_size||''),'pt-BR',{numeric:true}));
 const selected=currentSku(products,ui?.skuId)?.id;
 const editorTab=['cadastro','variacoes','compras','codigos'].includes(ui?.editorTab)?ui.editorTab:'cadastro';
 const cats=selectableProductCategories(categories,model?.category_id||main.category_id)
  .map(c=>[c.id,c.label]);
 const tagValue=(model?.tags||main.tags||[]).join(', ');
 const title=model?.name||main.name;
 const hasVariants=Boolean(group.modelId);
 const catId=model?.category_id||main.category_id;
 const currentIsParent=categories.some(c=>c.parent_id===catId);
 const catSelect='<div class="cdsb-category-chooser" data-product-category-chooser>'+
  '<label>Pesquisar categoria ou subcategoria'+
   '<input type="search" data-product-category-search placeholder="Ex.: imagens sacras, camisetas…" autocomplete="off" spellcheck="false" aria-label="Pesquisar categorias finais">'+
  '</label>'+
  '<label>Categoria, subcategoria e níveis inferiores'+
   '<select name="category_id" data-product-category-select required aria-label="Selecionar categoria final">'+
    cats.map(([value,label])=>'<option value="'+safe(value)+'"'+(String(value)===String(catId)?' selected':'')+'>'+safe(label)+'</option>').join('')+
   '</select></label>'+
  '<small class="cdsb-edit-hint" data-product-category-count>'+cats.length+' categorias disponíveis. Apenas a categoria final de cada ramo é exibida.</small>'+
  '<small class="cdsb-edit-hint" data-product-category-current>Caminho selecionado: '+safe(categoryPath(categories,catId)||'Não informado')+
   (currentIsParent?' (categoria geral existente)':'')+'</small>'+
  '</div>';
 const cadastro='<form data-form="product-card-basic" data-id="'+safe(model?.id||main.id)+
   '" data-is-model="'+hasVariants+'">'+
  '<div class="cdsb-edit-fields">'+
   input('Nome do produto','name',title,'maxlength="180" required')+
   input('Tags (separadas por vírgula)','tags',tagValue,'maxlength="500"')+
   catSelect+
   (!hasVariants?'<label>Situação'+dropdown('active',[['true','Ativo'],['false','Inativo']],String(main.active))+'</label>':'')+
  '</div>'+save('Salvar cadastro')+'</form>';
 let variants='';
 if(hasVariants){
  const variantsList=products.map(p=>{
   const allowed=resolveCategoryVariations(categories,model?.category_id).options;
   const values=[...new Set([...(allowed||[]),p.apparel_size||''].filter(Boolean))];
   const open=ui?.variantId===p.id;
   const form='<form data-form="product-card-variant" data-id="'+safe(p.id)+'">'+
    '<input type="hidden" name="sku" value="'+safe(p.sku||'')+'">'+
    '<input type="hidden" name="ean" value="'+safe(p.ean||'')+'">'+
    '<input type="hidden" name="color" value="'+safe(p.apparel_color||'Única')+'">'+
    '<div class="cdsb-edit-fields columns-2"><label>Variação'+dropdown('size',values.map(v=>[v,v]),p.apparel_size)+'</label>'+
     '<label>Situação'+dropdown('active',[['true','Ativa'],['false','Inativa']],String(p.active))+'</label></div>'+
     '<p class="cdsb-edit-hint">Códigos, gôndola e prateleira são editados na seção Códigos e localização. Fornecedor e mínimos ficam em Compras.</p>'+
     save('Salvar variação')+'</form>';
   return '<div class="cdsb-variant-entry" data-product-variant="'+safe(p.id)+'">'+
    '<div class="cdsb-variant-summary"><div><strong>'+safe(p.apparel_size||'Único')+'</strong>'+
      (!p.active?'<span class="cdsb-inactive-label">Inativa</span>':'')+
      '<small>SKU: '+safe(p.sku||'—')+' · EAN: '+safe(p.ean||'—')+'</small></div>'+
      button(open?'Recolher':'Editar','data-action="product-card-variant-toggle" data-id="'+safe(p.id)+'"')+
    '</div><div class="cdsb-variant-inline"'+(open?'':' hidden')+'>'+form+'</div></div>';
  }).join('');
  variants='<div class="cdsb-edit-variant-list">'+variantsList+'</div>'+
   '<div class="cdsb-edit-foot-actions">'+
    button('+ Adicionar variação','data-action="add-variants" data-id="'+safe(group.modelId)+'"')+
   '</div>';
 }else variants='<p class="cdsb-edit-hint">Este produto não possui variações cadastradas.</p>';
 const supplierItems=[['','Sem fornecedor'],...suppliers.filter(s=>s.active||products.some(p=>p.supplier_id===s.id)).map(s=>[s.id,s.name])];
 const purchase=products.map(p=>{
  const body='<div class="cdsb-edit-fields columns-2">'+
   '<label>Fornecedor padrão'+dropdown('supplier_id',supplierItems,p.supplier_id||'')+'</label>'+
   input('Estoque mínimo','min_stock',p.min_stock??0,'type="number" min="0" max="1000000" step="1" required')+
   input('Pedido mínimo','minimum_order_quantity',p.minimum_order_quantity??1,'type="number" min="1" max="1000000" step="1" required')+
   input('Preço de venda (R$)','sale_price',p.sale_price??'','type="number" min="0" max="99999999.99" step="0.01"')+
   '<label>Unidade de venda'+dropdown('sales_unit',[['UN','Unidade'],['PC','Peça'],['CX','Caixa']],p.sales_unit||'UN')+'</label>'+
   '</div><p class="cdsb-edit-hint">O estoque mínimo e o pedido mínimo são independentes para cada SKU. Nenhuma dessas alterações movimenta saldos.</p>'+
   '<div class="cdsb-edit-footer">'+
    (hasVariants?button('Aplicar a todas as variações','data-action="product-card-purchase-all" data-model-id="'+safe(group.modelId)+'"'):'')+
    '<button type="submit" class="button primary">Salvar compras</button></div>';
  return subpanel(group,p,'purchase',p.id===selected,body);
 }).join('');
 const options=[['','Sem gôndola definida'],...gondolas.filter(g=>g.active||products.some(p=>p.gondola===g.name)).map(g=>[g.name,g.name])];
 const codes=products.map(p=>{
  const body='<div class="cdsb-edit-fields columns-2">'+
   input('Código interno (SKU)','sku',p.sku||'','maxlength="80"')+
   input('EAN / código de barras','ean',p.ean||'','inputmode="numeric" maxlength="14"')+
   '<label>Gôndola'+dropdown('gondola',options,p.gondola||'')+'</label>'+
   input('Prateleira','prateleira',p.prateleira||'','maxlength="40"')+
   '</div>'+save('Salvar códigos e localização');
  return subpanel(group,p,'codes',p.id===selected,body);
 }).join('');
 const tabs=[['cadastro','Cadastro'],...(hasVariants?[['variacoes','Variações']]:[]),
   ['compras','Compras'],['codigos','Códigos e localização']];
 const actualTab=hasVariants||editorTab!=='variacoes'?editorTab:'cadastro';
 const tabsHtml='<div class="card-workspace-tabs cdsb-card-workspace-tabs" role="tablist" aria-label="Editar produto">'+
  tabs.map(([key,label])=>'<button type="button" data-action="product-editor-tab" data-tab="'+key+
   '" role="tab" aria-selected="'+String(key===actualTab)+'">'+safe(label)+'</button>').join('')+'</div>';
 const admin='<details class="card-editor-accordion card-admin-tools"><summary>Administração avançada</summary>'+
  '<p>Exclusão de cadastros exige permissão e preserva as proteções para pedidos e históricos.</p>'+
  (group.modelId&&canDeleteWholeModel?
   button('Excluir produto completo','data-action="product-model-delete" data-id="'+safe(group.modelId)+'"','danger'):'')+
  (!group.modelId&&canDeleteProduct?
   button('Excluir produto','data-action="product-delete" data-id="'+safe(main.id)+'"','danger'):'')+
  '</details>';
 return '<details class="product-card-editor card-workspace cdsb-card-editor" data-product-editor'+
  (ui?.panel==='editor'?' open':'')+'>'+
  '<summary>Editar cadastro do produto</summary>'+tabsHtml+
  '<section data-editor-panel="cadastro"'+(actualTab==='cadastro'?'':' hidden')+'>'+cadastro+'</section>'+
  (hasVariants?'<section data-editor-panel="variacoes"'+(actualTab==='variacoes'?'':' hidden')+'>'+variants+'</section>':'')+
  '<section data-editor-panel="compras"'+(actualTab==='compras'?'':' hidden')+'>'+
    (hasVariants?skuPicker(products,selected):'')+purchase+'</section>'+
  '<section data-editor-panel="codigos"'+(actualTab==='codigos'?'':' hidden')+'>'+
    (hasVariants?skuPicker(products,selected):'')+codes+'</section>'+
  admin+'</details>';
}
