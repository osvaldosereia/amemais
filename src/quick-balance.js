import {findProductByCode} from './product-code-search.js?v=20261027lookup1';
// Área independente de balanço e movimentação rápida por EAN/SKU.
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const quickModes=[
 {id:'contagem',label:'Atualizar estoque',permission:'stock.balance'},
 {id:'entrada',label:'Dar entrada',permission:'stock.entry'},
 {id:'saida',label:'Dar saída',permission:'stock.exit'}
];
export function findQuickStockProduct(items,code){
 const raw=String(code??'').trim();
 const eligible=(Array.isArray(items)?items:[]).filter(p=>p&&!p.force_archived_at);
 let result=findProductByCode(eligible,raw,{activeOnly:false});
 // Aceita EAN digitado com separadores, sem alterar SKU original nem remover zeros à esquerda.
 if(result.status==='notfound'&&/^[0-9\s-]+$/.test(raw)&&/[\s-]/.test(raw)){
  const digits=raw.replace(/[\s-]/g,'');
  if(digits.length>=8&&digits.length<=14)result=findProductByCode(eligible,digits,{activeOnly:false});
 }
 if(result.status==='ambiguous')return {item:null,matches:result.matches,status:'ambiguous',
  error:'Código corresponde a mais de um produto. Selecione o SKU correto abaixo.'};
 if(result.item)return {item:result.item,matches:[result.item],status:result.status,error:null};
 return {item:null,matches:[],status:result.status,error:result.status==='empty'?'Informe o EAN ou SKU.':
  'Código não encontrado. Confira o EAN ou SKU.'};
}
export function quickStockResult(item,{physical=0,reserved=0,mode='contagem',can=()=>false}={}){
 if(!item)return '<div class="quick-balance-placeholder"><strong>Aguardando leitura</strong>'+
  '<p>Leia o EAN com o leitor USB, digite o código ou utilize a câmera.</p></div>';
 const available=quickModes.filter(m=>can(m.permission));
 const active=available.find(m=>m.id===mode)||available[0];
 if(!active)return '<p class="quick-balance-error">Você não possui permissão para movimentar estoque.</p>';
 const modes=available.map(m=>'<button type="button" class="quick-balance-mode'+
  (active.id===m.id?' is-active':'')+'" data-action="quick-balance-mode" data-mode="'+m.id+
  '" aria-pressed="'+String(active.id===m.id)+'">'+m.label+'</button>').join('');
 const stock=Math.max(0,Number(physical)||0),reservedUnits=Math.max(0,Number(reserved)||0);
 const quantity=active.id==='contagem'?stock:1;
 const photo=item.image_path||item.image_paths?.[0];
 return '<section class="quick-balance-product">'+
  '<header class="quick-balance-product-head">'+
   (photo?'<img class="quick-balance-photo" data-photo-path="'+h(photo)+'" alt="Foto de '+h(item.name)+'">':
    '<div class="quick-balance-photo is-empty" aria-hidden="true">▧</div>')+
   '<div><strong>'+h(item.name)+'</strong>'+
    '<small>'+(item.apparel_size?h(item.apparel_size)+' · ':'')+'SKU '+h(item.sku||'—')+
    ' · EAN '+h(item.ean||'—')+(item.active?'':' · Inativo')+'</small></div></header>'+
  '<div class="quick-balance-stock">'+
   '<div><small>Físico</small><strong>'+stock+'</strong></div>'+
   '<div><small>Reservado</small><strong>'+reservedUnits+'</strong></div>'+
   '<div><small>Disponível</small><strong>'+Math.max(0,stock-reservedUnits)+'</strong></div></div>'+
  '<nav class="quick-balance-modes" aria-label="Operação de estoque">'+modes+'</nav>'+
  '<form data-form="quick-balance-action" data-id="'+h(item.id)+'" data-mode="'+active.id+
   '" data-expected="'+stock+'" data-reserved="'+reservedUnits+'" data-request-id="">'+
   '<label class="quick-balance-quantity"><span>'+
    (active.id==='contagem'?'Estoque físico contado':active.id==='entrada'?'Quantidade de entrada':'Quantidade de saída')+
    '</span><input name="quantity" type="number" min="'+(active.id==='contagem'?'0':'1')+
    '" max="1000000" step="1" inputmode="numeric" value="'+quantity+
    '" required data-quick-balance-quantity></label>'+
   '<p class="quick-balance-preview" data-quick-balance-preview aria-live="polite">'+
      h(quickBalancePreview(active.id,stock,reservedUnits,quantity))+'</p>'+
   '<button class="button primary quick-balance-submit" type="submit">'+
    (active.id==='contagem'?'Atualizar estoque':active.id==='entrada'?'Confirmar entrada':'Confirmar saída')+
    '</button></form>'+
  (can('products.edit')?
   '<div class="quick-balance-photo-action">'+
   '<button type="button" class="button quick-balance-photo-button" data-action="quick-balance-product-photo" data-id="'+h(item.id)+'">📷 Tirar foto e salvar no cadastro</button>'+
   '<small>A foto é compactada para até 100 KB; salvar ativa um produto inativo e preserva o estoque.</small>'+
   '</div>':'')+'</section>';
}
export function quickBalancePreview(mode,current,reserved,quantity){
 const n=Number(quantity);if(!Number.isInteger(n)||n<0||n>1000000)return 'Informe uma quantidade válida.';
 if(mode!=='contagem'&&n===0)return 'Informe uma quantidade maior que zero.';
 const next=mode==='contagem'?n:mode==='entrada'?current+n:current-n;
 if(next<reserved)return 'Quantidade insuficiente: existem '+reserved+' unidade(s) reservadas.';
 if(next>1000000)return 'Limite máximo de estoque: 1.000.000 unidades.';
 return 'Estoque físico: '+current+' → '+next+' unidade(s).'+
   (mode==='contagem'?' Diferença: '+(next-current>0?'+':'')+(next-current)+'.':'');
}
export function quickBalancePage(result=quickStockResult(null)){
 return '<section class="quick-balance-page">'+
  '<div class="quick-balance-page-head"><div><h1>Balanço rápido</h1>'+
  '<p>Leia o EAN/SKU, escolha a operação e confirme. Sem justificativa manual.</p></div></div>'+
  '<div class="quick-balance-find"><label for="quick-balance-barcode">Código de barras ou SKU</label>'+
  '<div class="quick-balance-search-row"><input id="quick-balance-barcode" data-quick-balance-barcode '+
  'type="search" enterkeyhint="search" inputmode="search" aria-label="Buscar EAN ou SKU" '+
  'placeholder="Bipe ou digite o EAN/SKU" autocomplete="off" autofocus>'+
  '<button class="button primary" type="button" data-action="quick-balance-search">Buscar</button>'+
  '<button class="button" type="button" data-action="quick-balance-camera">Ler pela câmera</button></div>'+
  '<small>Leitor USB: pressione Enter. Também é possível digitar e clicar em Buscar.</small></div>'+
  '<div data-quick-balance-result>'+result+'</div></section>';
}
