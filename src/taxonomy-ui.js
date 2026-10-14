// AME MAIS | Seletor visual único, sem opções nativas do Android/iOS.
// Exibe níveis por navegação, pesquisa por caminho completo e mantém o formulário atrás intacto.
let active = null;
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const sort = arr => [...arr].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
const children = (list,parent) => sort(list.filter(c=>(c.parent_id||null)===(parent||null)));
const chain = (list,id) => {
  const byId=new Map(list.map(c=>[c.id,c])),out=[],seen=new Set();
  let current=byId.get(id);
  while(current&&!seen.has(current.id)){seen.add(current.id);out.unshift(current);current=byId.get(current.parent_id);}
  return out;
};
const fullPath=(list,id)=>chain(list,id).map(c=>c.name).join(' / ');

export function closeTaxonomyPicker(restoreFocus=true){
  if(!active)return;
  const previous=active;
  active=null;
  previous.layer.remove();
  if(previous.backdrop?.isConnected)previous.backdrop.inert=false;
  if(restoreFocus&&previous.trigger?.isConnected)previous.trigger.focus();
}

function render(){
  if(!active)return;
  const {layer,mode,list}=active;
  const query=layer.querySelector('[data-taxonomy-query]').value.trim().toLocaleLowerCase('pt-BR');
  const trail=layer.querySelector('[data-taxonomy-trail]'), results=layer.querySelector('[data-taxonomy-results]');
  const valid=list.filter(c=>!active.excludeId||!chain(list,c.id).some(a=>a.id===active.excludeId));
  if(mode==='tag'){
    trail.innerHTML='<span>Tags disponíveis</span>';
    const matches=valid.filter(t=>!query||t.name.toLocaleLowerCase('pt-BR').includes(query));
    results.innerHTML=matches.map(t=>'<button type="button" class="tax-item tax-item-tag" data-tax-select="'+esc(t.name)+'"><strong>'+esc(t.name)+'</strong><span>✓</span></button>').join('')||
      '<p class="tax-empty">Nenhuma tag encontrada.</p>';
    return;
  }
  const row=(item,search=false)=>{
    const descendants=valid.filter(c=>c.parent_id===item.id).length;
    const color=(item.depth-1)%6+1;
    return '<div class="tax-item-row tax-level-'+color+'">'+
      '<button type="button" class="tax-item" data-tax-select="'+esc(item.id)+'">'+
      '<span class="tax-item-name"><strong>'+esc(search?fullPath(valid,item.id):item.name)+'</strong>'+
      '<small>'+(search?'Nível '+item.depth:descendants?descendants+' subcategoria(s)':'Selecionar')+'</small></span>'+
      '<span aria-hidden="true">✓</span></button>'+
      (!search&&descendants?'<button type="button" class="tax-drill" data-tax-parent="'+esc(item.id)+'" aria-label="Abrir subcategorias de '+esc(item.name)+'">›</button>':'')+
      '</div>';
  };
  if(query){
    trail.textContent='Resultados da busca';
    const matches=valid.filter(c=>fullPath(valid,c.id).toLocaleLowerCase('pt-BR').includes(query));
    results.innerHTML=matches.map(c=>row(c,true)).join('')||'<p class="tax-empty">Nenhuma categoria encontrada.</p>';
    return;
  }
  const parent=active.parent;
  const crumbs=chain(valid,parent);
  trail.innerHTML='<button type="button" data-tax-parent="">Início</button>'+
    crumbs.map(c=>'<span>›</span><button type="button" data-tax-parent="'+esc(c.id)+'">'+esc(c.name)+'</button>').join('');
  const items=children(valid,parent);
  results.innerHTML=(parent&&valid.some(c=>c.id===parent)?
    '<button type="button" class="tax-current" data-tax-select="'+esc(parent)+'">✓ Usar '+esc(valid.find(c=>c.id===parent).name)+'</button>':'')+
    items.map(item=>row(item)).join('')+
    (!items.length?'<p class="tax-empty">'+(parent?'Não há mais subcategorias neste nível.':'Nenhuma categoria cadastrada.')+'</p>':'');
}

export function openTaxonomyPicker({trigger,categories,selected='',mode='product',excludeId=null,onSelect}){
  closeTaxonomyPicker(false);
  if(typeof onSelect!=='function'||!trigger)return;
  const list=mode==='tag'?categories:categories.map(c=>({...c}));
  const backdrop=trigger.closest('.modalback');
  const layer=document.createElement('div');
  layer.className='tax-backdrop';
  layer.innerHTML='<section class="tax-sheet" role="dialog" aria-modal="true" aria-label="'+esc(mode==='tag'?'Selecionar tag':'Selecionar categoria')+'">'+
    '<header class="tax-header"><div><small>AME MAIS · Organização</small><h2>'+esc(mode==='tag'?'Selecionar tag':mode==='parent'?'Categoria superior':'Selecionar categoria')+'</h2></div>'+
    '<button class="tax-close" type="button" data-tax-close aria-label="Fechar">✕</button></header>'+
    '<label class="tax-search"><span aria-hidden="true">⌕</span><input data-taxonomy-query type="search" placeholder="'+
    (mode==='tag'?'Buscar tag…':'Buscar categoria ou subcategoria…')+'" autocomplete="off" aria-label="Pesquisar opções"></label>'+
    '<div class="tax-trail" data-taxonomy-trail></div>'+
    '<div class="tax-results" data-taxonomy-results></div>'+
    '<footer class="tax-footer"><button class="button" type="button" data-tax-clear>'+esc(mode==='filter'?'Todas as categorias':mode==='tag'?'Todas as tags':mode==='parent'?'Sem categoria superior':'Sem categoria')+'</button>'+
    '<button class="button" type="button" data-tax-close>Cancelar</button></footer></section>';
  if(backdrop)backdrop.inert=true;
  document.body.append(layer);
  active={layer,backdrop,trigger,mode,list,excludeId,onSelect,parent: mode==='tag'?null:chain(list,selected).at(-2)?.id||null};
  layer.addEventListener('click',event=>{
    if(event.target===layer){closeTaxonomyPicker();return;}
    if(event.target.closest('[data-tax-close]')){closeTaxonomyPicker();return;}
    const clear=event.target.closest('[data-tax-clear]');
    const selection=event.target.closest('[data-tax-select]');
    if(clear||selection){
      const value=clear?'':selection.dataset.taxSelect;
      const apply=active.onSelect;closeTaxonomyPicker();
      apply(value);return;
    }
    const parent=event.target.closest('[data-tax-parent]');
    if(parent){
      active.parent=parent.dataset.taxParent||null;
      layer.querySelector('[data-taxonomy-query]').value='';
      render();
    }
  });
  layer.querySelector('[data-taxonomy-query]').addEventListener('input',render);
  layer.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.stopPropagation();closeTaxonomyPicker();}
  });
  render();
  layer.querySelector('[data-taxonomy-query]').focus();
}
