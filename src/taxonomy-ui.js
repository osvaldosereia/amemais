// AME MAIS | Seletor próprio: um toque navega no grupo, um toque escolhe a folha.
// Compatível com categorias profundas, busca por caminho e tags; não abre o teclado sozinho.
let active=null;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const byName=items=>[...items].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
const lineage=(list,id)=>{
  const map=new Map(list.map(item=>[item.id,item])),out=[],seen=new Set();
  let item=map.get(id);
  while(item&&!seen.has(item.id)){
    seen.add(item.id);out.unshift(item);item=map.get(item.parent_id);
  }
  return out;
};
const pathName=(list,id)=>lineage(list,id).map(item=>item.name).join(' / ');

export function closeTaxonomyPicker(restoreFocus=true){
  if(!active)return;
  const previous=active;active=null;
  previous.layer.remove();
  if(previous.backdrop?.isConnected)previous.backdrop.inert=false;
  if(restoreFocus&&previous.trigger?.isConnected)previous.trigger.focus({preventScroll:true});
}

function allowedCategories(){
  const {list,excludeId}=active;
  if(!excludeId)return list;
  return list.filter(c=>!lineage(list,c.id).some(node=>node.id===excludeId));
}
function categoryEntry(category,list,{search=false}={}){
  const subcategories=list.filter(child=>child.parent_id===category.id).length;
  const selected=active.selected===category.id;
  const depth=category.depth||lineage(list,category.id).length;
  const label=search?pathName(list,category.id):category.name;
  const action=search||!subcategories?'data-tax-select':'data-tax-parent';
  const buttonText=search?'Selecionar':subcategories?'Abrir':'Selecionar';
  return '<button type="button" class="tax-category-entry tax-level-'+((depth-1)%6+1)+
    (selected?' tax-selected':'')+'" '+action+'="'+esc(category.id)+'"'+
    ' aria-label="'+esc(buttonText+' '+label)+'">'+
    '<span class="tax-category-entry-text"><strong>'+esc(label)+'</strong>'+
    '<small>'+esc(search?'Nível '+depth+(subcategories?' · '+subcategories+' subcategoria(s)':''):
      subcategories?subcategories+' subcategoria(s)':'Categoria final')+'</small></span>'+
    '<span class="tax-category-entry-action">'+(selected?'✓ ': '')+buttonText+
      '<span aria-hidden="true">'+(subcategories&&!search?' ›':'')+'</span></span>'+
    '</button>';
}
function render(){
  if(!active)return;
  const {layer,mode,list}=active;
  const searchField=layer.querySelector('[data-taxonomy-query]');
  const query=searchField.value.trim().toLocaleLowerCase('pt-BR');
  const trail=layer.querySelector('[data-taxonomy-trail]');
  const results=layer.querySelector('[data-taxonomy-results]');
  const helper=layer.querySelector('[data-taxonomy-helper]');

  if(mode==='tag'){
    helper.textContent='Toque na tag desejada.';
    trail.innerHTML='<span>Tags cadastradas</span>';
    const filtered=byName(list).filter(tag=>!query||tag.name.toLocaleLowerCase('pt-BR').includes(query));
    results.innerHTML=filtered.map(tag=>'<button type="button" class="tax-tag-choice" data-tax-select="'+esc(tag.name)+'">'+
      '<strong>'+esc(tag.name)+'</strong><span>Selecionar ›</span></button>').join('')||
      '<p class="tax-empty">Nenhuma tag encontrada.</p>';
    return;
  }
  const valid=allowedCategories();
  if(query){
    helper.textContent='Resultados: toque na categoria para selecioná-la.';
    trail.innerHTML='<span>Busca por nome ou caminho completo</span>';
    const found=byName(valid.filter(cat=>pathName(valid,cat.id).toLocaleLowerCase('pt-BR').includes(query)));
    results.innerHTML=found.map(cat=>categoryEntry(cat,valid,{search:true})).join('')||
      '<p class="tax-empty">Nenhuma categoria encontrada. Experimente outro termo.</p>';
    return;
  }
  const parent=active.parent;
  const chain=lineage(valid,parent);
  helper.textContent='Toque em um grupo para ver suas subcategorias, ou em uma categoria final para selecioná-la.';
  trail.innerHTML='<button type="button" data-tax-parent="">Todas</button>'+
    chain.map(cat=>'<span class="tax-crumb-separator">›</span>'+
      '<button type="button" data-tax-parent="'+esc(cat.id)+'">'+esc(cat.name)+'</button>').join('');
  const current=parent?valid.find(c=>c.id===parent):null;
  const all=byName(valid.filter(c=>(c.parent_id||null)===(parent||null)));
  results.innerHTML=(current?'<button type="button" class="tax-current-choice" data-tax-select="'+esc(current.id)+'">'+
    '<span><small>Categoria deste nível</small><strong>✓ Usar '+esc(current.name)+'</strong></span><span>Selecionar ›</span></button>':'')+
    (all.length?all.map(cat=>categoryEntry(cat,valid)).join(''):
      '<p class="tax-empty">'+(current?'Sem outras subcategorias. Use a categoria acima ou volte.':'Não há categorias cadastradas.')+'</p>');
}

export function openTaxonomyPicker({trigger,categories,selected='',mode='product',excludeId=null,onSelect}){
  closeTaxonomyPicker(false);
  if(!trigger||typeof onSelect!=='function')return;
  const backdrop=trigger.closest('.modalback');
  const layer=document.createElement('div');
  layer.className='tax-backdrop';
  layer.innerHTML='<section class="tax-sheet" role="dialog" aria-modal="true" aria-label="'+
    esc(mode==='tag'?'Selecionar tag':'Selecionar categoria')+'">'+
    '<header class="tax-header"><div><small>AME MAIS · Organização</small><h2>'+
    esc(mode==='tag'?'Selecionar tag':mode==='parent'?'Categoria superior':'Selecionar categoria')+
    '</h2></div><button class="tax-close" type="button" data-tax-close aria-label="Fechar">✕</button></header>'+
    '<div class="tax-search"><span aria-hidden="true">⌕</span><input type="search" data-taxonomy-query '+
    'autocomplete="off" placeholder="'+esc(mode==='tag'?'Buscar tag…':'Buscar categoria ou subcategoria…')+
    '" aria-label="Pesquisar opções"></div>'+
    '<p class="tax-helper" data-taxonomy-helper></p>'+
    '<nav class="tax-trail" data-taxonomy-trail aria-label="Caminho da categoria"></nav>'+
    '<div class="tax-results" data-taxonomy-results></div>'+
    '<footer class="tax-footer"><button type="button" class="button" data-tax-clear>'+
    esc(mode==='filter'?'Todas as categorias':mode==='tag'?'Todas as tags':mode==='parent'?'Sem categoria superior':'Sem categoria')+
    '</button><button type="button" class="button" data-tax-close>Cancelar</button></footer></section>';

  if(backdrop)backdrop.inert=true;
  document.body.append(layer);
  const list=mode==='tag'?categories:[...categories];
  const selectedParent=lineage(list,selected);
  active={layer,backdrop,trigger,mode,list,excludeId,onSelect,
    selected,parent:mode==='tag'?null:(selectedParent.length>1?selectedParent.at(-2).id:null)};
  // Eventos delegados: o toque no nome da categoria com filhos agora abre o grupo,
  // nunca seleciona sem intenção. Folhas e resultados da busca selecionam.
  layer.addEventListener('click',event=>{
    if(event.target===layer||event.target.closest('[data-tax-close]')){
      closeTaxonomyPicker();return;
    }
    const selection=event.target.closest('[data-tax-select]');
    const clear=event.target.closest('[data-tax-clear]');
    if(selection||clear){
      const value=clear?'':selection.dataset.taxSelect;
      const cb=active.onSelect;
      closeTaxonomyPicker();
      cb(value);return;
    }
    const enter=event.target.closest('[data-tax-parent]');
    if(enter){
      active.parent=enter.dataset.taxParent||null;
      const search=layer.querySelector('[data-taxonomy-query]');
      search.value='';
      // No teclado aberto, devolva o espaço para a lista de categorias.
      if(document.activeElement===search)search.blur();
      render();
      layer.querySelector('[data-taxonomy-results]').scrollTop=0;
    }
  });
  layer.querySelector('[data-taxonomy-query]').addEventListener('input',render);
  layer.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.stopPropagation();closeTaxonomyPicker();}
  });
  render();
  // Foca o botão fechar (acessibilidade), jamais a busca: Android não abre teclado.
  layer.querySelector('[data-tax-close]')?.focus({preventScroll:true});
}
