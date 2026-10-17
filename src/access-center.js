/* Central de Pessoas e Acessos | apresentação pura e segura.
 * Perfis personalizados são gerenciados exclusivamente por administradores.
 */
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const d=value=>value?new Date(value).toLocaleString('pt-BR'):'—';
export function accessCenterHTML({users=[],profiles=[],assignments=[],stores=[],staffStores=[],events=[],members=[],audits=[],contacts=[],tab='pessoas',archived=false,button,profileLabels={}}={}){
 const active=users.filter(u=>!u.archived_at),old=users.filter(u=>Boolean(u.archived_at));
 const grouped=new Map(assignments.map(a=>[a.user_id,a]));
 const names=new Map(profiles.map(p=>[p.id,p]));
 const selected=archived?old:active;
 const safeTab=['pessoas','perfis','vinculos','auditoria'].includes(tab)?tab:'pessoas';
 const navigation=[['pessoas','Pessoas'],['perfis','Perfis'],['vinculos','Vínculos'],['auditoria','Auditoria']]
  .map(([key,label])=>button(label,'access-tab','data-tab="'+key+'"','small'+(safeTab===key?' primary':''))).join('');
 const counter='<div class="ac-metrics"><div><strong>'+active.filter(u=>u.active).length+'</strong><small>Ativos</small></div>'+
  '<div><strong>'+active.filter(u=>!u.active).length+'</strong><small>Bloqueados</small></div>'+
  '<div><strong>'+profiles.filter(p=>p.is_active).length+'</strong><small>Perfis ativos</small></div>'+
  '</div>';
 const profileName=u=>names.get(grouped.get(u.id)?.profile_id)?.name||profileLabels[u.role]||u.role||'Sem perfil';
 const people='<section class="ac-section"><div class="ac-toolbar">'+
  '<label class="ac-search"><span>Buscar pessoa</span><input type="search" data-users-search placeholder="Nome, usuário, perfil ou unidade"></label>'+
  '<label><span>Perfil</span><select data-users-filter-role><option value="">Todos os perfis</option>'+
   [...new Set(users.map(u=>u.role))].map(role=>'<option value="'+e(role)+'">'+e(profileLabels[role]||role)+'</option>').join('')+'</select></label>'+
   button(archived?'Ver equipe atual':'Ver arquivados','users-archived-toggle','','small')+'</div>'+
  '<div class="ac-person-list" data-users-list>'+(
  selected.length?selected.map(u=>{
   const assignmentsForUser=staffStores.filter(v=>v.user_id===u.id).map(v=>stores.find(s=>s.id===v.store_id)?.name).filter(Boolean);
   const title=profileName(u),contact=contacts.find(c=>c.user_id===u.id);
   const filter=[u.full_name,u.username,title,assignmentsForUser.join(' '),contact?.job_title].join(' ').toLowerCase();
   return '<article class="ac-person" data-user-row data-user-filter="'+e(filter)+'" data-user-role="'+e(u.role)+'">'+
    '<span class="um-avatar">'+e((u.full_name||'?').slice(0,1).toUpperCase())+'</span>'+
    '<div class="ac-person-main"><strong>'+e(u.full_name)+'</strong><small>@'+e(u.username)+
    ' · '+e(title)+(assignmentsForUser.length?' · '+e(assignmentsForUser.join(', ')):'')+'</small></div>'+
    '<span class="ac-status '+(u.archived_at?'off':u.active?'on':'off')+'">'+
      (u.archived_at?'Arquivado':u.active?'Ativo':'Bloqueado')+'</span>'+
    button(u.archived_at?'Restaurar':'Gerenciar',u.archived_at?'user-restore':'user-workspace','data-id="'+e(u.id)+'"','small')+'</article>';
  }).join(''):'<p class="ac-empty">Nenhuma pessoa nesta visualização.</p>')+'</div></section>';
 const profileCards=profiles.slice().sort((a,b)=>Number(a.is_system)-Number(b.is_system)||a.name.localeCompare(b.name,'pt-BR')).map(p=>{
  const assigned=assignments.filter(a=>a.profile_id===p.id).length;
  return '<article class="ac-profile-card"><div class="ac-profile-icon" aria-hidden="true">♙</div>'+
   '<div class="ac-profile-main"><strong>'+e(p.name)+'</strong><small>'+e(p.description||'Sem descrição')+'</small>'+
   '<span class="ac-profile-meta">'+assigned+' usuário(s) · '+(p.is_system?'Perfil-base protegido':p.role_kind==='gerente'?'Equipe interna':p.role_kind==='franquia'?'Franquia':p.role_kind==='evento'?'Loja temporária':p.role_kind==='consulta'?'Consulta':'Separação')+
   (p.is_active?'':' · Inativo')+'</span></div>'+
   (p.is_system?'<span class="ac-static-chip">Protegido</span>'+button('Duplicar','access-profile-copy','data-id="'+e(p.id)+'"','small'):button('Editar','access-profile-edit','data-id="'+e(p.id)+'"','small')+
    button('Duplicar','access-profile-copy','data-id="'+e(p.id)+'"','small'))+
   '</article>';
 }).join('');
 const profileView='<section class="ac-section"><div class="ac-section-head"><div><h2>Perfis de acesso</h2>'+
  '<p>Crie conjuntos reutilizáveis de permissões sem alterar os perfis-base.</p></div>'+
  button('+ Criar perfil','access-profile-new','','primary')+'</div><div class="ac-profile-grid">'+profileCards+'</div></section>';
 const unitRows=[...stores.map(s=>({id:s.id,name:s.name,category:s.is_primary?'Centro de distribuição':s.kind==='franquia'?'Franquia':'Loja',n:staffStores.filter(x=>x.store_id===s.id).length})),
   ...events.filter(x=>!x.deleted_at).map(x=>({id:x.id,name:x.name,category:'Loja temporária',n:members.filter(m=>m.event_id===x.id).length}))];
 const units='<section class="ac-section"><div class="ac-section-head"><h2>Unidades e eventos</h2>'+
  '<p class="ac-help">Gerencie vínculos na ficha de cada pessoa.</p></div>'+
  unitRows.map(x=>'<article class="ac-unit"><span class="ac-unit-icon" aria-hidden="true">⌂</span>'+
    '<div><strong>'+e(x.name)+'</strong><small>'+e(x.category)+'</small></div>'+
    '<span class="ac-unit-count">'+x.n+' vínculo(s)</span></article>').join('')+'</section>';
 const peopleNames=new Map(users.map(x=>[x.id,x.full_name]));
 const log=audits.filter(a=>['staff_profiles','access_profiles'].includes(a.entity))
  .slice(0,75);
 const history='<section class="ac-section"><div class="ac-section-head"><h2>Auditoria de acessos</h2>'+
  '<p class="ac-help">Últimos registros disponíveis. Operações detalhadas continuam no histórico do sistema.</p></div>'+
  (log.length?log.map(a=>'<article class="ac-log"><div><strong>'+e(a.action)+'</strong>'+
   '<small>'+e(peopleNames.get(a.actor_id)||'Administrador')+' · '+e(d(a.created_at))+'</small></div></article>').join(''):
   '<p class="ac-empty">Nenhuma alteração de acesso nos registros recentes.</p>')+'</section>';
 return '<section class="ac-root"><div class="ac-heading"><div><h1>Pessoas e Acessos</h1>'+
  '<p>Administre equipe, perfis, vínculos e auditoria em um só lugar.</p></div>'+
  (safeTab==='pessoas'?button('+ Novo usuário','user-new','','primary'):safeTab==='perfis'?button('+ Criar perfil','access-profile-new','','primary'):'')+
  '</div>'+counter+'<nav class="ac-tabs" aria-label="Áreas de pessoas e acessos">'+navigation+'</nav>'+
  (safeTab==='pessoas'?people:safeTab==='perfis'?profileView:safeTab==='vinculos'?units:history)+'</section>';
}
