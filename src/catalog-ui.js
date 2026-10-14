// AME MAIS | Administração simplificada de categorias e tags.
// UI não altera a estrutura, a integridade e a auditoria existentes do Supabase.
export function makeCategoryStats(categories,products){
  const map=new Map(categories.map(c=>[c.id,{directActive:0,directInactive:0,branchActive:0,branchInactive:0}]));
  const parents=new Map(categories.map(c=>[c.id,c.parent_id]));
  for(const p of products){
    if(!map.has(p.category_id))continue;
    const active=Boolean(p.active);
    map.get(p.category_id)[active?'directActive':'directInactive']++;
    let id=p.category_id,guard=new Set();
    while(id&&map.has(id)&&!guard.has(id)){
      guard.add(id);
      map.get(id)[active?'branchActive':'branchInactive']++;
      id=parents.get(id);
    }
  }
  return map;
}
export function rankTagsForCategory({categoryId,categories,products,tags,selected=[]}){
  const selectedNames=new Set(selected.map(v=>v.toLocaleLowerCase('pt-BR')));
  const names=tags.map(t=>t.name);
  if(!categoryId)return {recommended:tags.filter(t=>selectedNames.has(t.name.toLocaleLowerCase('pt-BR'))),other:tags.filter(t=>!selectedNames.has(t.name.toLocaleLowerCase('pt-BR')))};
  const byId=new Map(categories.map(c=>[c.id,c]));
  const chain=id=>{
    const out=[],seen=new Set();let c=byId.get(id);
    while(c&&!seen.has(c.id)){out.unshift(c.id);seen.add(c.id);c=byId.get(c.parent_id);}
    return out;
  };
  const target=chain(categoryId),scores=new Map(),unique=new Set();
  for(const p of products){
    if(!p.active||!p.category_id||!Array.isArray(p.tags)||!p.tags.length)continue;
    const theirs=chain(p.category_id);
    let score=0;
    if(p.category_id===categoryId)score=12;
    else if(theirs.includes(categoryId))score=8;
    else if(target.includes(p.category_id))score=5;
    else {
      const common=theirs.filter(id=>target.includes(id)).length;
      if(common>=2)score=2;
    }
    if(!score)continue;
    // Uma roupa com sete tamanhos é apenas um modelo para sugerir tags.
    const productKey=p.apparel_model_id||p.id;
    for(const tag of p.tags){
      const normalized=tag.toLocaleLowerCase('pt-BR');
      const key=productKey+'|'+normalized;
      if(unique.has(key))continue;
      unique.add(key);
      scores.set(normalized,(scores.get(normalized)||0)+score);
    }
  }
  const relevant=tags.filter(t=>(scores.get(t.name.toLocaleLowerCase('pt-BR'))||0)>0||
    selectedNames.has(t.name.toLocaleLowerCase('pt-BR')));
  relevant.sort((a,b)=>{
    const va=scores.get(a.name.toLocaleLowerCase('pt-BR'))||0,vb=scores.get(b.name.toLocaleLowerCase('pt-BR'))||0;
    return vb-va||a.name.localeCompare(b.name,'pt-BR');
  });
  const recommendedSet=new Set(relevant.map(t=>t.name.toLocaleLowerCase('pt-BR')));
  return {recommended:relevant,other:tags.filter(t=>!recommendedSet.has(t.name.toLocaleLowerCase('pt-BR')))
    .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))};
}
export function catalogCategoryRows({categories,items,expanded,query,h,button,categoryChain,categoryFull}){
  const q=(query||'').trim().toLocaleLowerCase('pt-BR');
  const stats=makeCategoryStats(categories,items);
  const byParent=new Map();
  for(const c of categories){
    const parent=c.parent_id||null;
    if(!byParent.has(parent))byParent.set(parent,[]);
    byParent.get(parent).push(c);
  }
  for(const arr of byParent.values())arr.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const ordered=[],visited=new Set(),walk=(c,depth)=>{
    if(visited.has(c.id))return;
    visited.add(c.id);ordered.push({c,depth});
    for(const sub of byParent.get(c.id)||[])walk(sub,depth+1);
  };
  for(const c of byParent.get(null)||[])walk(c,1);
  for(const c of categories)if(!visited.has(c.id))walk(c,Math.max(c.depth||1,1));
  const matches=new Set();
  if(q)for(const {c} of ordered){
    const path=categoryChain(c.id).map(x=>x.name).join(' / ').toLocaleLowerCase('pt-BR');
    if(path.includes(q))for(const p of categoryChain(c.id))matches.add(p.id);
  }
  const visible=ordered.filter(({c})=>{
    if(q)return matches.has(c.id);
    return categoryChain(c.id).slice(0,-1).every(ancestor=>expanded.has(ancestor.id));
  });
  const rootCount=categories.filter(c=>!c.parent_id).length;
  const cards=visible.map(({c,depth})=>{
    const hasChildren=(byParent.get(c.id)||[]).length>0;
    const opened=expanded.has(c.id);
    const stat=stats.get(c.id)||{directActive:0,directInactive:0,branchActive:0,branchInactive:0};
    const archived=stat.directInactive;
    return '<article class="catalog-category-node '+(depth===1?'root-node':'')+'" style="--catalog-depth:'+
      Math.min(depth-1,9)+'" data-category-node="'+h(c.id)+'">'+
      '<div class="catalog-node-main">'+
      (hasChildren?'<button type="button" class="catalog-expand" data-action="category-toggle" data-id="'+h(c.id)+
        '" aria-label="'+(opened?'Recolher':'Expandir')+' '+h(c.name)+'" aria-expanded="'+opened+'">'+(q||opened?'▾':'▸')+'</button>':
        '<span class="catalog-expand catalog-expand-placeholder" aria-hidden="true">•</span>')+
      (hasChildren?'<button type="button" class="catalog-node-info catalog-node-open" data-action="category-toggle" data-id="'+h(c.id)+'" aria-expanded="'+opened+'">':
        '<div class="catalog-node-info">')+
      '<strong>'+h(c.name)+'</strong>'+
      '<small>'+h(depth===1?'Categoria principal':categoryFull(c.parent_id))+'</small>'+
      (hasChildren?'</button>':'</div>')+
      '<div class="catalog-node-count"><strong>'+stat.directActive+'</strong><span>ativo(s) aqui</span>'+
      (archived?'<small>'+archived+' inativo(s) no histórico</small>':'')+
      (hasChildren&&stat.branchActive>stat.directActive?'<small>'+stat.branchActive+' ativo(s) no ramo</small>':'')+'</div>'+
      '</div><div class="catalog-node-actions">'+
      button('+ Subcategoria','category-child','data-id="'+h(c.id)+'"','small')+
      button('Editar','category-edit','data-id="'+h(c.id)+'"','small')+
      button('Excluir','category-delete','data-id="'+h(c.id)+'"','small danger')+'</div></article>';
  }).join('');
  return '<div class="catalog-tree-summary">'+rootCount+' categorias principais · '+
    items.filter(p=>p.active).length+' produto(s)/variação(ões) ativos no sistema</div>'+
    (cards||'<div class="catalog-no-results">'+(q?'Nenhuma categoria encontrada.':'Nenhuma categoria cadastrada.')+'</div>');
}
export function catalogTagCards({tags,items,query,h,button}){
  const q=(query||'').trim().toLocaleLowerCase('pt-BR');
  const counts=new Map();
  const seen=new Set();
  for(const p of items){
    if(!p.active)continue;
    const key=p.apparel_model_id||p.id;
    for(const t of p.tags||[]){
      const n=t.toLocaleLowerCase('pt-BR');
      if(seen.has(key+'|'+n))continue;
      seen.add(key+'|'+n);
      counts.set(n,(counts.get(n)||0)+1);
    }
  }
  const ordered=[...tags].sort((a,b)=>(counts.get(b.name.toLocaleLowerCase('pt-BR'))||0)-
    (counts.get(a.name.toLocaleLowerCase('pt-BR'))||0)||
    a.name.localeCompare(b.name,'pt-BR')).filter(t=>t.name.toLocaleLowerCase('pt-BR').includes(q));
  return ordered.map(t=>{
    const count=counts.get(t.name.toLocaleLowerCase('pt-BR'))||0;
    return '<article class="catalog-tag-card"><span class="catalog-tag-name">'+h(t.name)+'</span>'+
      '<small>'+count+' produto(s) ativo(s)</small>'+
      button('Excluir','tag-delete','data-id="'+h(t.id)+'"','small danger')+'</article>';
  }).join('')||'<p class="catalog-no-results">'+(q?'Nenhuma tag corresponde à busca.':'Nenhuma tag cadastrada.')+'</p>';
}
