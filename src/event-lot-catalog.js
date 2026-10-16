// Catálogo visual para montar pedidos de lojas temporárias.
// Um modelo pode ter muitas variações, mas conta como apenas um item do limite de 10.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
const PAGE = 18;

export function makeLotModels(groups, models = [], categories = []) {
 const modelMap = new Map(models.map(m => [m.id,m]));
 const catMap = new Map(categories.map(c => [c.id,c]));
 return groups.map(g => {
  const first = g.products[0] || {};
  const model = modelMap.get(first.apparel_model_id);
  const categoryId = model?.category_id || first.category_id || '';
  const ancestors = [];
  let cat = catMap.get(categoryId);
  const visited = new Set();
  while (cat && !visited.has(cat.id)) {
   visited.add(cat.id);ancestors.unshift(cat.id);
   cat = catMap.get(cat.parent_id);
  }
  const categoryLabel = ancestors.map(id => catMap.get(id)?.name).filter(Boolean).join(' › ') || 'Sem categoria';
  const tags = [...new Set([...(model?.tags||[]),...g.products.flatMap(p=>p.tags||[])])].filter(Boolean);
  const variants = g.products.filter(p => p.active !== false || Number(p.planned||0)>0);
  const available = variants.reduce((sum,p)=>sum+Math.max(0,Number(p.available)||0),0);
  const photo = model?.image_paths?.[0] || model?.image_path ||
   variants.find(p=>p.image_paths?.length)?.image_paths?.[0] ||
   variants.find(p=>p.image_path)?.image_path || '';
  const search = norm([g.title,categoryLabel,...tags,...variants.flatMap(p=>[
   p.name,p.apparel_color,p.apparel_size,p.sku,p.ean])].join(' '));
  return {...g, variants, categoryId, ancestors, categoryLabel, tags, available, photo, search,
   variantCount:variants.length};
 }).filter(g => g.variants.length);
}
export function lotCatalogMarkup(groups,categories=[],models=[],{showAvailable=true}={}){
 const catalogue=makeLotModels(groups,models,categories);
 const roots=categories.filter(c=>!c.parent_id).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const categoriesWithProducts=categories.filter(c=>catalogue.some(g=>g.ancestors.includes(c.id)))
  .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const tags=[...new Set(catalogue.flatMap(g=>g.tags))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 return '<section class="lot-catalog" data-lot-catalog>'+
  '<div class="lot-search-line"><label class="lot-search-label"><span class="sr-only">Buscar produtos</span>'+
    '<input type="search" class="search" data-plan-search data-lot-search autocomplete="off"'+
    ' placeholder="Buscar produto, cor, tamanho, SKU ou EAN…"></label>'+
    '<button type="button" class="button" data-action="event-plan-scan" aria-label="Ler código EAN">▥ Ler EAN</button></div>'+
  '<div class="lot-roots" aria-label="Navegar por departamentos">'+
    '<button type="button" class="lot-root active" data-action="lot-root" data-category="" aria-pressed="true">Todos</button>'+
    roots.filter(c=>catalogue.some(g=>g.ancestors.includes(c.id))).map(c=>
     '<button type="button" class="lot-root" data-action="lot-root" data-category="'+esc(c.id)+'" aria-pressed="false">'+esc(c.name)+'</button>').join('')+'</div>'+
  '<div class="lot-filters">'+
   '<label>Categoria<select data-lot-category><option value="">Todas as categorias</option>'+
     categoriesWithProducts.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select></label>'+
   '<label>Tag<select data-lot-tag><option value="">Todas as tags</option>'+
     tags.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('')+'</select></label>'+
   (showAvailable?'<label>Estoque<select data-lot-stock><option value="all">Todos</option>'+
     '<option value="available">Com saldo livre</option><option value="unavailable">Sem saldo livre</option></select></label>':'')+
   '<label>Ordenar<select data-lot-sort><option value="name">Nome A–Z</option>'+
     '<option value="stock">Maior disponibilidade</option><option value="variety">Mais variações</option></select></label>'+
  '</div>'+
  '<div class="lot-catalog-tabs" role="group" aria-label="Visualização do catálogo">'+
   '<button type="button" class="lot-tab active" data-action="lot-view" data-view="catalog" aria-pressed="true">Explorar catálogo</button>'+
   '<button type="button" class="lot-tab" data-action="lot-view" data-view="selected" aria-pressed="false">Minha seleção <b data-lot-tab-count>0</b></button>'+
   '<button type="button" class="lot-reset" data-action="lot-reset">Limpar filtros</button>'+
  '</div>'+
  '<p class="lot-results" data-lot-results aria-live="polite">'+catalogue.length+' modelos no catálogo</p>'+
  '<div class="lot-card-grid" data-lot-results-list></div>'+
  '<button class="lot-more" type="button" data-action="lot-more" hidden>Mostrar mais modelos</button>'+
  '</section>';
}
export function mountLotCatalog(form,{groups=[],models=[],categories=[],showAvailable=true,onRender=()=>{}}={}){
 const catalogue=makeLotModels(groups,models,categories);
 const selected=new Map();
 const productKeys=new Map();
 for(const group of catalogue){
  for(const p of group.variants){
   productKeys.set(p.id,group.key);
   if(Number(p.planned)>0)selected.set(p.id,Number(p.planned));
  }
 }
 form.__lotPicker={catalogue,selected,productKeys,onRender,showAvailable,view:'catalog',page:1,opened:new Set(),invalid:false};
 for(const g of catalogue)if(g.variants.some(p=>selected.has(p.id)))form.__lotPicker.opened.add(g.key);
 filterLotCatalog(form);
}
const countGroup=(group,selected)=>group.variants.reduce((sum,p)=>sum+(selected.get(p.id)||0),0);
export function selectedLotCount(form){
 const x=form?.__lotPicker;
 if(!x)return {models:0,units:0};
 let models=0,units=0;
 for(const g of x.catalogue){
  const n=countGroup(g,x.selected);
  if(n>0){models++;units+=n;}
 }
 return {models,units};
}
function cards(group,store){
 const n=countGroup(group,store.selected),isOpen=store.opened.has(group.key),available=group.available>0;
 const photo=group.photo?'<img data-photo-path="'+esc(group.photo)+'" alt="Foto de '+esc(group.title)+'" loading="lazy">':
  '<span class="lot-no-photo" aria-label="Sem foto cadastrada">Sem foto</span>';
 const colors=[...new Set(group.variants.map(p=>p.apparel_color).filter(Boolean))];
 return '<article class="lot-card'+(n?' selected':'')+'" data-lot-card="'+esc(group.key)+'">'+
  '<div class="lot-card-main"><div class="lot-card-photo">'+photo+'</div>'+
   '<div class="lot-card-details">'+
    '<small class="lot-category">'+esc(group.categoryLabel)+'</small>'+
    '<h3>'+esc(group.title)+'</h3>'+
    (group.tags.length?'<div class="lot-tags">'+group.tags.slice(0,3).map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>':'')+
    '<p class="lot-card-stats">'+group.variantCount+' variação(ões)'+
     (colors.length?' · '+colors.length+' cor(es)':'')+
     (store.showAvailable?' · <b class="'+(available?'':'lot-zero')+'">'+group.available+' livres</b>':'')+'</p>'+
    '<div class="lot-card-actions"><button type="button" class="lot-expand" data-action="lot-expand" data-key="'+esc(group.key)+'" aria-expanded="'+isOpen+'">'+
     (isOpen?'Ocultar opções':'Ver cores e tamanhos')+'</button>'+
    (n?'<strong class="lot-picked" data-lot-picked="'+esc(group.key)+'">'+n+' un. escolhidas</strong>':'<span data-lot-picked="'+esc(group.key)+'"></span>')+
    '</div></div></div>'+
   '<div class="lot-variants"'+(isOpen?'':' hidden')+'>'+group.variants.map(p=>{
    const current=store.selected.get(p.id)||0;
    const variation=[p.apparel_color,p.apparel_size].filter(Boolean).join(' · ')||p.name;
    return '<div class="lot-variant"><div><strong>'+esc(variation)+'</strong>'+
     '<small>SKU '+esc(p.sku||'—')+' · EAN '+esc(p.ean||'—')+'</small>'+
     (store.showAvailable?'<small class="'+(p.available>0?'':'lot-zero')+'">Livre: '+Number(p.available||0)+'</small>':'')+
     '</div><label>Quantidade <input type="number" inputmode="numeric" step="1" min="0" max="1000000"'+
      ' data-plan-qty data-id="'+esc(p.id)+'" value="'+current+'" aria-label="Quantidade de '+esc(variation)+'"></label></div>';
   }).join('')+
    (n?'<button type="button" class="lot-remove" data-action="lot-clear-model" data-key="'+esc(group.key)+'">Remover modelo do pedido</button>':'')+
   '</div></article>';
}
export function filterLotCatalog(form,{resetPage=false}={}){
 const store=form?.__lotPicker;
 if(!store)return;
 if(resetPage)store.page=1;
 const scope=form.querySelector('[data-lot-catalog]'),list=scope?.querySelector('[data-lot-results-list]');
 if(!list)return;
 const query=norm(scope.querySelector('[data-lot-search]')?.value||'');
 const category=scope.querySelector('[data-lot-category]')?.value||'';
 const tag=scope.querySelector('[data-lot-tag]')?.value||'';
 const stock=scope.querySelector('[data-lot-stock]')?.value||'all';
 const sort=scope.querySelector('[data-lot-sort]')?.value||'name';
 const terms=query.split(/\s+/).filter(Boolean);
 let found=store.catalogue.filter(g=>{
  if(store.view==='selected')return countGroup(g,store.selected)>0;
  return (!category||g.ancestors.includes(category))&&
   (!tag||g.tags.includes(tag))&&
   (stock==='all'||(stock==='available'?g.available>0:g.available<=0))&&
   terms.every(term=>g.search.includes(term));
 });
 found.sort((a,b)=>{
  if(sort==='stock'&&a.available!==b.available)return b.available-a.available;
  if(sort==='variety'&&a.variantCount!==b.variantCount)return b.variantCount-a.variantCount;
  return a.title.localeCompare(b.title,'pt-BR');
 });
 const total=found.length,shown=store.view==='selected'?found:found.slice(0,store.page*PAGE);
 list.innerHTML=shown.map(g=>cards(g,store)).join('')||
  '<div class="lot-empty">'+(store.view==='selected'?'Seu pedido está vazio. Volte ao catálogo para explorar produtos.':
   'Nenhum modelo com estes filtros. Experimente outra categoria ou limpe a busca.')+'</div>';
 const more=scope.querySelector('[data-action="lot-more"]');
 if(more){more.hidden=shown.length>=total;more.textContent='Mostrar mais ('+(total-shown.length)+' restantes)';}
 const info=scope.querySelector('[data-lot-results]');
 if(info)info.textContent=store.view==='selected'?'Revisão do pedido · '+total+' modelo(s) selecionado(s)':
  (total===store.catalogue.length?total+' modelos disponíveis para explorar':total+' de '+store.catalogue.length+' modelos encontrados')+
  (total>PAGE?' · mostrando '+shown.length:'');
 for(const tab of scope.querySelectorAll('[data-action="lot-view"]')){
  const active=tab.dataset.view===store.view;tab.classList.toggle('active',active);
  tab.setAttribute('aria-pressed',String(active));
 }
 const count=scope.querySelector('[data-lot-tab-count]');
 if(count)count.textContent=String(selectedLotCount(form).models);
 for(const root of scope.querySelectorAll('[data-action="lot-root"]')){
  const active=root.dataset.category===category;
  root.classList.toggle('active',active);
  root.setAttribute('aria-pressed',String(active));
 }
 // O catálogo usa carregamento incremental; a seleção vive no Map, inclusive para modelos fora da página.
 store.onRender();
}
export function onLotQuantityInput(form,input){
 const store=form?.__lotPicker;
 if(!store)return {ok:false,error:'Pedido indisponível'};
 const id=input.dataset.id,key=store.productKeys.get(id);
 if(!key)return {ok:false,error:'Variação inválida'};
 const raw=input.value.trim(),value=raw===''?0:Number(raw);
 if(!Number.isInteger(value)||value<0||value>1000000){
  input.value=String(store.selected.get(id)||0);
  input.setCustomValidity('');
  return {ok:false,error:'Use uma quantidade inteira de 0 a 1.000.000.'};
 }
 store.invalid=false;input.setCustomValidity('');
 const previous=store.selected.get(id)||0;
 if(value>0)store.selected.set(id,value);else store.selected.delete(id);
 const card=input.closest('[data-lot-card]');
 if(card){
  const group=store.catalogue.find(g=>g.key===key),n=countGroup(group,store.selected);
  card.classList.toggle('selected',n>0);
  const label=card.querySelector('[data-lot-picked]');
  if(label)label.textContent=n?n+' un. escolhidas':'';
 }
 const count=form.querySelector('[data-lot-tab-count]');
 if(count)count.textContent=String(selectedLotCount(form).models);
 return {ok:true};
}
export function lotCatalogAction(form,button){
 const store=form?.__lotPicker,scope=form?.querySelector('[data-lot-catalog]');
 if(!store||!scope)return false;
 const action=button.dataset.action;
 if(action==='lot-more')store.page++;
 else if(action==='lot-expand'){
  const key=button.dataset.key;
  if(store.opened.has(key))store.opened.delete(key);else store.opened.add(key);
 }else if(action==='lot-clear-model'){
  const group=store.catalogue.find(g=>g.key===button.dataset.key);
  if(group)for(const p of group.variants)store.selected.delete(p.id);
  if(group)store.opened.delete(group.key);
 }else if(action==='lot-view'){
  store.view=button.dataset.view==='selected'?'selected':'catalog';store.page=1;
 }else if(action==='lot-root'){
  const next=button.dataset.category||'',selector=scope.querySelector('[data-lot-category]');
  if(selector)selector.value=selector.value===next?'':next;
  store.view='catalog';store.page=1;
 }else if(action==='lot-reset'){
  for(const selector of scope.querySelectorAll('[data-lot-category],[data-lot-tag],[data-lot-stock],[data-lot-sort]'))
   selector.value=selector.hasAttribute('data-lot-stock')?'all':selector.hasAttribute('data-lot-sort')?'name':'';
  const search=scope.querySelector('[data-lot-search]');
  if(search)search.value='';
  store.view='catalog';store.page=1;
 }else return false;
 filterLotCatalog(form);
 return true;
}
export function collectLotItems(form){
 const store=form?.__lotPicker;if(!store)throw Error('Pedido não inicializado.');
 if(store.invalid||form.querySelector('[data-plan-qty]:invalid'))throw Error('Corrija as quantidades inválidas.');
 const items=[...store.selected].map(([product_id,quantity])=>({product_id,quantity}));
 if(items.some(x=>!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>1000000))
  throw Error('Quantidade inválida.');
 if(items.length>5000)throw Error('Pedido excede o limite técnico de segurança de 5.000 SKUs.');
 return items;
}
