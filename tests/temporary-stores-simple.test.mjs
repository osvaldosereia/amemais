import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const moduleFrom=async name=>{
 const source=await readFile(new URL('../src/'+name,import.meta.url),'utf8');
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
};
const {
 eventPickingRows,eventPlanForm,eventSettlementForm,eventCompactDetail,
 damageListHTML,a4PickingHTML
}=await moduleFrom('event-simple.js');
const {groupInventory}=await moduleFrom('stock-workflows.js');
const products=['P','M','GG','XGG'].map((size,i)=>({
 id:'sku-'+size,name:'Camiseta Branca / '+size,apparel_model_id:'modelo',
 apparel_size:size,apparel_color:'Branco',sku:'1000'+i,ean:'000100111'+i,active:true
}));
const models=[{id:'modelo',name:'Camiseta Masculina HDH'}];
const plan=[{product_id:products[0].id,quantity:1},{product_id:products[1].id,quantity:2},
 {product_id:products[2].id,quantity:3},{product_id:products[3].id,quantity:4}];
const h=x=>String(x),button=(label,action,attr='')=>
 '<button data-action="'+action+'" '+attr+'>'+label+'</button>';
const event={id:'event-id',name:'Evento Teste 1',status:'rascunho',
 starts_at:'2026-10-14',ends_at:'2026-10-15'};
test('a lista de separação mantém todos os tamanhos e quantidades editáveis',()=>{
 const groups=eventPickingRows(products,models,plan,()=>15);
 assert.equal(groups.length,1);
 assert.equal(groups[0].products.reduce((sum,p)=>sum+p.planned,0),10);
 const html=eventPlanForm(groups);
 assert.equal((html.match(/data-plan-qty/g)||[]).length,4);
 assert.match(html,/data-plan-search/);
 assert.match(html,/event-plan-scan/);
 assert.match(html,/0001001110/);
});
test('complemento inicia com zero, sem alterar a primeira lista',()=>{
 const html=eventPlanForm(eventPickingRows(products,models,plan,()=>15),{additional:true});
 assert.equal((html.match(/data-plan-qty[^>]*value="0"/g)||[]).length,4);
 assert.match(html,/Motivo do complemento/);
});
test('conferência mostra produtos bons, vendidos, avariados e perdidos por SKU',()=>{
 const balances=plan.map(x=>({product_id:x.product_id,quantity:x.quantity}));
 const html=eventSettlementForm(eventPickingRows(products,models,plan),balances);
 assert.equal((html.match(/data-settle-row/g)||[]).length,4);
 for(const name of ['good','sold','damaged','lost'])assert.match(html,new RegExp('data-settle-field="'+name+'"'));
 assert.match(html,/Marcar restante vendido/);
});
test('a home de loja em preparação permite impressão A4 e envio',()=>{
 const html=eventCompactDetail({event,plan:{revision:2},planItems:plan.map(x=>({...x,event_id:event.id})),
  balances:[],movements:[],shipments:[],groupInventory,products,models,h,button,
  canPlan:true,canClose:true});
 assert.match(html,/event-plan/);assert.match(html,/event-print/);assert.match(html,/event-dispatch/);
 assert.match(html,/10/);
});
test('loja em operação mostra conferência sem cinco cartões de histórico expandidos',()=>{
 const active={...event,status:'ativo'};
 const balances=plan.map(x=>({...x,event_id:active.id}));
 const html=eventCompactDetail({event:active,balances,planItems:[],shipments:[],
  movements:[],products,models,groupInventory,h,button,canPlan:true,canClose:true});
 assert.match(html,/event-settle/);
 assert.match(html,/event-supplement/);
 assert.match(html,/event-product-compact/);
 assert.match(html,/Histórico e rastreabilidade/);
});
test('relatório A4 apresenta tamanhos, SKU, EAN, quantidade e campos manuscritos',()=>{
 const html=a4PickingHTML({event,items:plan,products,models,responsible:'Responsável de teste',
  printedAt:'14/10/2026 09:00',version:'Revisão 2'});
 assert.match(html,/@page\{size:A4 portrait/);
 assert.match(html,/LISTA DE SEPARAÇÃO/);
 assert.match(html,/Total previsto: 10 unidades/);
 assert.match(html,/Conferido por/);
 assert.match(html,/window\.print\(\)/);
 for(const p of products){assert(html.includes(p.sku));assert(html.includes(p.ean))}
});
test('avarias pendentes oferecem resolver e mantêm histórico',()=>{
 const html=damageListHTML([
 {id:'damage-1',product_id:products[0].id,remaining:2,quantity:3,recovered:1,discarded:0,note:'Costura aberta'},
 {id:'damage-2',product_id:products[1].id,remaining:0,quantity:1,recovered:0,discarded:1,note:'Inutilizável'}
 ],products,[],[],{h,button});
 assert.match(html,/2 em análise/);
 assert.match(html,/damage-resolve/);
 assert.match(html,/Ocorrências resolvidas/);
});

test('exclusão de loja é oferecida apenas com permissão e impressão exibe uma foto por modelo',()=>{
 const allowed=eventCompactDetail({
  event,products,models,groupInventory,h,button,canManage:true,canDelete:true
 });
 const blocked=eventCompactDetail({
  event,products,models,groupInventory,h,button,canManage:true,canDelete:false
 });
 assert.match(allowed,/data-action="event-delete"/);
 assert.doesNotMatch(blocked,/data-action="event-delete"/);
 const withImages=products.map((p,i)=>({...p,image_path:i===0?'produtos/modelo.jpg':null}));
 const a4=a4PickingHTML({event,items:plan,products:withImages,models,
  photoUrls:{'produtos/modelo.jpg':'https://example.com/img.jpg'}
 });
 assert.equal((a4.match(/class="event-print-photo"/g)||[]).length,1);
 assert.match(a4,/SKU/);
 assert.match(a4,/document.images/);
});
