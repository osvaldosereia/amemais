/* CDSB | Usuários, fornecedores e tarefas ligadas à operação.
 * Renderização pura: validações e alertas não fazem chamadas externas. */
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const onlyDigits=v=>String(v??'').replace(/\D/g,'');
export function supplierDirectoryPayload(values){
 const name=String(values.name||'').trim();
 if(name.length<2||name.length>150)throw Error('Informe o nome do fornecedor (2 a 150 caracteres).');
 const email=String(values.email||'').trim().toLowerCase();
 if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>180))
  throw Error('Informe um email válido para o fornecedor.');
 const rawDays=String(values.delivery_days??'').trim();
 const deliveryDays=rawDays===''?null:Number(rawDays);
 if(deliveryDays!==null&&(!Number.isInteger(deliveryDays)||deliveryDays<1||deliveryDays>365))
  throw Error('O prazo de entrega deve ser de 1 a 365 dias.');
 const rawMinimum=String(values.minimum_order_amount??'').trim().replace(',','.');
 const minimum=rawMinimum===''?null:Number(rawMinimum);
 if(minimum!==null&&(!Number.isFinite(minimum)||minimum<0||minimum>9999999999.99))
  throw Error('Informe um valor mínimo de pedido válido.');
 const channel=String(values.preferred_channel||'').trim();
 if(channel&&!['whatsapp','telefone','email','outro'].includes(channel))
  throw Error('Canal de contato inválido.');
 const str=(key,max)=>String(values[key]||'').trim().slice(0,max)||null;
 return {
  name,contact_name:str('contact_name',140),phone:str('phone',60),email:email||null,
  document:str('document',35),notes:str('notes',1500),legal_name:str('legal_name',180),
  contact_role:str('contact_role',100),whatsapp:str('whatsapp',60),
  website:str('website',250),address:str('address',500),
  payment_terms:str('payment_terms',500),delivery_days:deliveryDays,
  minimum_order_amount:minimum,preferred_channel:channel||null
 };
}
export function staffDirectoryPayload(values){
 const str=(key,max)=>String(values[key]||'').trim().slice(0,max)||null;
 const phone=str('phone',60),jobTitle=str('job_title',120),department=str('department',120),
  internalNotes=str('internal_notes',1500);
 return {phone,job_title:jobTitle,department,internal_notes:internalNotes};
}
export function procurementTaskDraft(values){
 const title=String(values.title||'').trim();
 if(title.length<3||title.length>160)throw Error('Informe uma tarefa com 3 a 160 caracteres.');
 const due=String(values.due_date||'').trim();
 if(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))throw Error('Data de vencimento inválida.');
 return {
  title,description:String(values.description||'').trim().slice(0,1500)||null,
  supplier_id:String(values.supplier_id||'')||null,
  assigned_to:String(values.assigned_to||'')||null,
  due_date:due||null,task_kind:'manual',status:'pendente'
 };
}
export function supplierInsights(supplier,products=[],orders=[],tasks=[]){
 const linked=products.filter(p=>p.supplier_id===supplier.id);
 const purchases=orders.filter(p=>p.supplier_id===supplier.id);
 const pending=tasks.filter(t=>t.supplier_id===supplier.id&&
  ['pendente','em_andamento'].includes(t.status)).length;
 return {skus:linked.length,purchases:purchases.length,pending};
}
export function procurementTasksHTML(tasks=[],suppliers=[],users=[],button,canManage=false){
 const pending=tasks.filter(t=>t.status!=='concluida'&&t.status!=='cancelada');
 const ordered=pending.slice().sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))||
  String(a.title||'').localeCompare(String(b.title||''),'pt-BR'));
 const date=d=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'Sem prazo';
 const today=new Date().toISOString().slice(0,10);
 return '<section class="directory-tasks"><div class="directory-tasks-head"><div><h2>Acompanhamentos e tarefas</h2>'+
  '<p>Pedidos de compra enviados geram uma tarefa interna de acompanhamento. Nenhuma mensagem é enviada automaticamente.</p></div>'+
  (canManage?button('Nova tarefa','buy-task-new','','small primary'):'')+'</div>'+
  '<div class="directory-task-counts"><span>'+pending.length+' pendente(s)</span>'+
  '<span>'+pending.filter(t=>t.due_date&&t.due_date<today).length+' atrasada(s)</span></div>'+
  '<div class="directory-task-list">'+
  (ordered.length?ordered.map(t=>{
   const name=suppliers.find(s=>s.id===t.supplier_id)?.name||'Sem fornecedor';
   const person=users.find(u=>u.id===t.assigned_to)?.full_name||'Não atribuído';
   const overdue=Boolean(t.due_date&&t.due_date<today);
   return '<article class="directory-task'+(overdue?' is-overdue':'')+'"><div class="directory-task-main">'+
     '<strong>'+h(t.title)+'</strong>'+
     '<small>'+h(name)+' · Responsável: '+h(person)+' · '+h(date(t.due_date))+'</small>'+
     (t.description?'<p>'+h(t.description)+'</p>':'')+
     '</div><div class="directory-task-actions">'+
     (t.status==='em_andamento'?'<span class="directory-task-status">Em andamento</span>':
      '<span class="directory-task-status">Pendente</span>')+
     (canManage?button('Concluir','buy-task-status','data-id="'+h(t.id)+'" data-status="concluida"','small'):
      t.assigned_to?button('Concluir','buy-task-status','data-id="'+h(t.id)+'" data-status="concluida"','small'):'')+
     (canManage&&t.status==='pendente'?button('Iniciar','buy-task-status',
       'data-id="'+h(t.id)+'" data-status="em_andamento"','small'):'')+
     '</div></article>';
  }).join(''):'<p class="help">Nenhuma tarefa em aberto.</p>')+'</div></section>';
}
