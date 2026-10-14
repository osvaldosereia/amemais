// AME MAIS: seleção progressiva de categorias com confirmação explícita.
// Desktop: colunas por nível. Celular: uma etapa por vez. A seleção só muda ao confirmar.
let active=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sort=items=>[...items].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
const parents=(list,id)=>{
  const byId=new Map(list.map(item=>[item.id,item])),path=[],seen=new Set();
  let item=byId.get(id);
  while(item&&!seen.has(item.id)){seen.add(item.id);path.unshift(item);item=byId.get(item.parent_id);}
  return path;
};
const titlePath=(list,id)=>parents(list,id).map(item=>item.name).join(' / ');
const currentItem=()=>active.list.find(c=>c.id===active.pending);
const children=(items,id)=>sort(items.filter(c=>(c.parent_id||null)===(id||null)));

export function closeTaxonomyPicker(focus=true){
  if(!active)return;
  const prev=active;active=null;
  prev.layer.remove();
  if(prev.backdrop?.isConnected)prev.backdrop.inert=false;
  if(focus&&prev.trigger?.isConnected)prev.trigger.focus({preventScroll:true});
}
function available(){
  if(!active.excludeId)return active.list;
  return active.list.filter(item=>!parents(active.list,item.id).some(p=>p.id===active.excludeId));
}
function choiceLabel(){
  if(!active.pending)return active.mode==='tag'?'Todas as tags':
    active.mode==='filter'?'Todas as categorias':
    active.mode==='parent'?'Categoria principal':'Nenhuma categoria';
  return active.mode==='tag'?active.pending:titlePath(active.list,active.pending);
}
function row(category,list,flat=false){
  const count=list.filter(c=>c.parent_id===category.id).length;
  const chosen=active.pending===category.id;
  const depth=parents(list,category.id).length||1;
  const parentPath=parents(list,category.id).slice(0,-1).map(p=>p.name).join(' / ');
  return '<button type="button" class="tax-v3-option '+(chosen?'selected ':'')+
    '" data-tax-pick="'+esc(category.id)+'" aria-pressed="'+chosen+'">'+
    '<span class="tax-v3-radio" aria-hidden="true">'+(chosen?'✓':'')+'</span>'+
    '<span class="tax-v3-option-text"><strong>'+esc(category.name)+'</strong>'+
    (flat?'<small>'+esc(parentPath||'Categoria principal')+'</small>':
      '<small>'+esc(count?count+' subcategoria'+(count===1?'':'s'):'Último nível')+'</small>')+
    '</span>'+(count?'<span class="tax-v3-next">›</span>':'')+'</button>';
}
function render(){
  if(!active)return;
  const {layer,mode,list}=active;
  const search=layer.querySelector('[data-taxonomy-query]');
  const query=(search?.value||'').trim().toLocaleLowerCase('pt-BR');
  const heading=layer.querySelector('[data-taxonomy-current]');
  const confirm=layer.querySelector('[data-tax-confirm]');
  const content=layer.querySelector('[data-taxonomy-results]');
  const preview=layer.querySelector('[data-taxonomy-selection]');
  const goBack=layer.querySelector('[data-tax-back]');
  preview.textContent=choiceLabel();
  confirm.textContent=mode==='filter'?'Aplicar filtro':mode==='tag'?'Aplicar tag':mode==='parent'?'Confirmar superior':'Confirmar categoria';
  if(mode==='tag'){
    const filtered=sort(list).filter(t=>!query||t.name.toLocaleLowerCase('pt-BR').includes(query));
    heading.textContent='Tags cadastradas';
    goBack.hidden=true;
    content.innerHTML='<div class="tax-v3-columns"><section class="tax-v3-level">'+
      '<div class="tax-v3-level-title">Selecione uma tag</div>'+
      filtered.map(t=>'<button class="tax-v3-option '+(active.pending===t.name?'selected':'')+
        '" type="button" data-tax-pick="'+esc(t.name)+'" aria-pressed="'+(active.pending===t.name)+'">'+
        '<span class="tax-v3-radio">'+(active.pending===t.name?'✓':'')+'</span><strong>'+esc(t.name)+'</strong></button>').join('')+
      (!filtered.length?'<p class="tax-v3-empty">Nenhuma tag encontrada.</p>':'')+'</section></div>';
    return;
  }
  const usable=available();
  if(query){
    heading.textContent='Resultados da busca';
    goBack.hidden=true;
    const found=sort(usable.filter(c=>titlePath(usable,c.id).toLocaleLowerCase('pt-BR').includes(query)));
    content.innerHTML='<div class="tax-v3-columns"><section class="tax-v3-level">'+
      '<div class="tax-v3-level-title">'+found.length+' categoria(s) encontrada(s)</div>'+
      found.map(c=>row(c,usable,true)).join('')+
      (!found.length?'<p class="tax-v3-empty">Nenhuma categoria encontrada.</p>':'')+'</section></div>';
    return;
  }
  const lineage=parents(usable,active.parent);
  const paneIds=[null,...lineage.map(c=>c.id)];
  // No desktop, até três níveis lado a lado; no celular, aparece apenas a etapa atual.
  const visiblePaneIds=paneIds.slice(-3);
  const focusItem=usable.find(c=>c.id===active.parent);
  heading.textContent=focusItem?'Dentro de '+focusItem.name:'Categorias principais';
  goBack.hidden=!active.parent;
  content.innerHTML='<div class="tax-v3-columns">'+visiblePaneIds.map((id,i)=>{
    const options=children(usable,id);
    const cat=id?usable.find(c=>c.id===id):null;
    const title=cat?'Dentro de '+cat.name:'Categorias principais';
    const isLast=i===visiblePaneIds.length-1;
    return '<section class="tax-v3-level '+(isLast?'tax-v3-active-level':'')+'" aria-label="'+esc(title)+'">'+
      '<div class="tax-v3-level-title"><span>Nível '+(id?parents(usable,id).length+1:1)+'</span><strong>'+esc(title)+'</strong></div>'+
      options.map(c=>row(c,usable)).join('')+
      (!options.length?'<p class="tax-v3-empty">Sem outras subcategorias.</p>':'')+'</section>';
  }).join('')+'</div>';
}
export function openTaxonomyPicker({trigger,categories,selected='',mode='product',excludeId=null,onSelect}){
  closeTaxonomyPicker(false);
  if(!trigger||typeof onSelect!=='function')return;
  const layer=document.createElement('div');
  layer.className='tax-backdrop tax-v3-backdrop';
  layer.innerHTML='<section class="tax-sheet tax-v3-sheet" role="dialog" aria-modal="true" aria-label="'+
    esc(mode==='tag'?'Selecionar tag':'Selecionar categoria')+'">'+
    '<header class="tax-header tax-v3-header"><div><small>AME MAIS · ORGANIZAÇÃO</small>'+
    '<h2>'+esc(mode==='tag'?'Selecionar tag':mode==='parent'?'Categoria superior':'Escolher categoria')+
    '</h2></div><button type="button" class="tax-close" data-tax-close aria-label="Fechar">✕</button></header>'+
    '<div class="tax-v3-intro">Escolha uma categoria em cada nível. Confirme no botão inferior.</div>'+
    '<div class="tax-search tax-v3-search"><span aria-hidden="true">⌕</span><input type="search" data-taxonomy-query '+
    'autocomplete="off" placeholder="Buscar pelo nome ou caminho…" aria-label="Buscar categorias"></div>'+
    '<div class="tax-v3-stage"><button type="button" data-tax-back class="tax-v3-back">← Voltar um nível</button>'+
    '<strong data-taxonomy-current>Categoria principal</strong></div>'+
    '<div class="tax-results tax-v3-results" data-taxonomy-results></div>'+
    '<footer class="tax-v3-footer"><div class="tax-v3-selected"><small>ESCOLHA ATUAL</small>'+
    '<strong data-taxonomy-selection></strong></div><div class="tax-v3-footer-actions">'+
    '<button type="button" class="button tax-v3-clear" data-tax-clear>'+
    (mode==='filter'?'Todas':mode==='tag'?'Todas':mode==='parent'?'Sem superior':'Sem categoria')+'</button>'+
    '<button type="button" class="button primary tax-v3-confirm" data-tax-confirm></button></div></footer></section>';
  const backdrop=trigger.closest('.modalback');
  if(backdrop)backdrop.inert=true;
  document.body.append(layer);
  const list=mode==='tag'?categories:[...categories];
  const lineage=parents(list,selected);
  const selectedCat=list.find(c=>c.id===selected);
  const hasChildren=selectedCat&&list.some(c=>c.parent_id===selected);
  active={trigger,backdrop,layer,list,excludeId,mode,onSelect,pending:selected,
    parent:mode==='tag'?null:
      hasChildren?selected:(lineage.length>1?lineage.at(-2).id:null)};
  layer.addEventListener('click',event=>{
    if(event.target===layer||event.target.closest('[data-tax-close]')){closeTaxonomyPicker();return;}
    if(event.target.closest('[data-tax-confirm]')){
      const callback=active.onSelect, value=active.pending;closeTaxonomyPicker();callback(value);return;
    }
    if(event.target.closest('[data-tax-clear]')){
      active.pending='';active.parent=null;
      const input=layer.querySelector('[data-taxonomy-query]');
      if(input){input.value='';input.blur();}
      render();return;
    }
    const back=event.target.closest('[data-tax-back]');
    if(back&&!back.hidden){
      const chain=parents(active.list,active.parent);
      active.parent=chain.length>1?chain.at(-2).id:null;
      active.pending=active.parent||'';
      render();return;
    }
    const choice=event.target.closest('[data-tax-pick]');
    if(choice){
      const id=choice.dataset.taxPick;
      active.pending=id;
      if(active.mode!=='tag'){
        const chosen=available().find(c=>c.id===id);
        if(chosen){
          const child=available().some(c=>c.parent_id===id);
          active.parent=child?id:(chosen.parent_id||null);
        }
        const input=layer.querySelector('[data-taxonomy-query]');
        if(input&&input.value){input.value='';input.blur();}
      }
      render();return;
    }
  });
  const input=layer.querySelector('[data-taxonomy-query]');
  input.addEventListener('input',render);
  layer.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.stopPropagation();closeTaxonomyPicker();}
  });
  render();
  // Android não abre teclado automaticamente: teclado somente ao tocar na busca.
  layer.querySelector('[data-tax-close]')?.focus({preventScroll:true});
}
