// Indicadores operacionais do início: mesma classificação usada na fila única.
// Não inclui pedidos concluídos/cancelados e não altera saldos ou reservas.
const closed=new Set(['enviado','despachado','concluido','recebido','recebido_divergente','cancelado','expirado']);
export const DASHBOARD_ORDER_STAGES=[
  {key:'a_separar',label:'A separar',icon:'clipboard'},
  {key:'em_separacao',label:'Em separação',icon:'package'},
  {key:'a_conferir',label:'A conferir',icon:'scan'},
  {key:'pronto_saida',label:'Para enviar',icon:'arrow'},
  {key:'pendente_estoque',label:'Com falta',icon:'alert'}
];
export function dashboardOrderStage(order){
  if(!order||closed.has(order.status))return null;
  const stage=order.workflow?.stage;
  if(stage==='conferencia'||(!stage&&order.status==='separado'))return 'a_conferir';
  if(stage==='expedicao')return 'pronto_saida';
  if(stage==='separacao'||(!stage&&order.status==='em_separacao'))return 'em_separacao';
  if(order.status==='pendente_estoque')return 'pendente_estoque';
  if(!stage&&['reservado','aprovado','aguardando'].includes(order.status))return 'a_separar';
  if(!stage&&['legado','solicitado'].includes(order.status))return 'a_preparar';
  return null;
}
const priority={pendente_estoque:0,a_conferir:1,pronto_saida:2,em_separacao:3,a_separar:4,a_preparar:5};
export function dashboardOrderSummary(orders=[]){
  const counts=Object.fromEntries(DASHBOARD_ORDER_STAGES.map(x=>[x.key,0]));
  counts.a_preparar=0;
  const attention=[];
  for(const order of orders){
    const stage=dashboardOrderStage(order);
    if(!stage)continue;
    counts[stage]++;
    attention.push({order,stage,priority:priority[stage]});
  }
  attention.sort((a,b)=>a.priority-b.priority||
    String(a.order.created_at||'').localeCompare(String(b.order.created_at||'')));
  return {counts,attention,pending:attention.length};
}
