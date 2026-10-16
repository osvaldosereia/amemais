import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// O projeto usa módulos ES diretamente no navegador, sem package.json.
// Carregar como data URL permite exercitar as mesmas funções no Node.
const source=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const {recentInventoryGroups,groupedCard}=await import('data:text/javascript;base64,'+
  Buffer.from(source).toString('base64'));

const blackSizes=['P','M','G','XGG'];
const blackQty=[135,70,130,95];
const black=blackSizes.map((size,index)=>({
  id:'preta-'+size,apparel_model_id:'modelo-preta',
  name:'Camiseta Masculina HDH tipo 2 · Preta / '+size,
  apparel_color:'Preta',apparel_size:size,active:true,
  created_at:index===3?'2026-10-14T14:00:00Z':'2026-10-10T14:00:00Z',
  sku:'1000'+index,ean:'000100'+index,image_path:index===0?'foto.webp':null
}));
const white=['P','M','GG','XGG'].map((size,index)=>({
  id:'branca-'+size,apparel_model_id:'modelo-branca',
  name:'Camiseta Masculina HDH · Branco / '+size,
  apparel_color:'Branco',apparel_size:size,active:true,
  created_at:'2026-10-12T15:00:00Z'
}));
const models=[
 {id:'modelo-preta',name:'Camiseta Masculina HDH tipo 2'},
 {id:'modelo-branca',name:'Camiseta Masculina HDH'}
];
test('oito SKUs de dois modelos geram dois cards inteiros',()=>{
  const groups=recentInventoryGroups([...white,...black],models,6);
  assert.equal(groups.length,2);
  assert.equal(groups[0].modelId,'modelo-preta');
  assert.equal(groups[0].products.length,4);
  assert.equal(groups[1].modelId,'modelo-branca');
  assert.equal(groups[1].products.length,4);
});
test('a variação mais recente determina a ordem do modelo sem excluir tamanhos',()=>{
  const groups=recentInventoryGroups([...white,...black],models,1);
  assert.equal(groups.length,1);
  assert.deepEqual(groups[0].products.map(p=>p.apparel_size),['P','M','G','XGG']);
});
test('produtos independentes ficam em cards separados, inativos não aparecem',()=>{
  const extra={id:'produto-unico',name:'Produto avulso',active:true,created_at:'2026-10-09T10:00:00Z'};
  const inactive={...extra,id:'produto-inativo',name:'Inativo',active:false};
  const groups=recentInventoryGroups([...black,extra,inactive],models,6);
  assert.equal(groups.length,2);
  assert(groups.some(g=>g.key==='product:produto-unico'));
  assert(!groups.some(g=>g.key==='product:produto-inativo'));
});
test('o mesmo renderer emite um card com painel retrátil e soma de estoque',()=>{
  const group=recentInventoryGroups(black,models,1)[0];
  const qty=Object.fromEntries(black.map((p,i)=>[p.id,blackQty[i]]));
  const html=groupedCard(group,{
    h:value=>String(value),photoButton:()=>'<button>Foto</button>',
    qtyStore:id=>qty[id],qtyEvent:()=>0,qtyReserved:()=>0,qtyAvailable:id=>qty[id],
    button:(label,action,extra='')=>'<button data-action="'+action+'" '+extra+'>'+label+'</button>',
    isManager:()=>true,canRegisterProducts:()=>true
  });
  assert.equal((html.match(/data-product-card=/g)||[]).length,1);
  assert.match(html,/Camiseta Masculina HDH tipo 2/);
  assert.match(html,/<b>430<\/b> un\./);
  assert.match(html,/4 variações/);
  assert.match(html,/data-action="product-card-sizes"/);
  assert.match(html,/data-product-details/);
  assert.match(html,/SKU 1000/);
});
