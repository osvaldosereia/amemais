import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const access=code.slice(code.indexOf('const accessPresets='),code.indexOf('function assertFranchiseProfile('));
const view=code.slice(code.indexOf('function usersPage(){'),code.indexOf('function closeTopModal(){'));
const factories=new Function('state','permissionCatalog','h',access+'return {permissionFields,accessPresets};');
const mockState={
 users:[{id:'u1',role:'franquia'}],
 staffStores:[{user_id:'u1',store_id:'s1'}],userPermissions:[],members:[{user_id:'u2',event_id:'ev'}],
 stores:[{id:'cd',name:'CDSB',kind:'central',is_primary:true,active:true},
  {id:'s1',name:'Cristo Rei',kind:'franquia',active:true},
  {id:'s2',name:'Franquia Poconé',kind:'franquia',active:true}],
 events:[{id:'ev',name:'Evento Teste',status:'ativo'},{id:'closed',name:'Encerrado',status:'encerrado'}]
};
const {permissionFields,accessPresets}=factories(mockState,
 [['products.read','Consultar produtos'],['orders.franchise','Criar pedido']],s=>String(s).replaceAll('"','&quot;'));
test('perfil de loja tem apenas pedido e catálogo',()=>{
 assert.deepEqual(accessPresets.franquia,['products.read','orders.franchise']);
});
test('perfil separador não expede mercadorias',()=>{
 assert.deepEqual(accessPresets.estoquista,['products.read','orders.read','orders.separate']);
 assert.ok(!accessPresets.estoquista.includes('orders.dispatch'));
});
test('perfil evento não registra vendas e possui vínculo próprio',()=>{
 assert.ok(accessPresets.evento.includes('events.request'));
 assert.ok(!accessPresets.evento.includes('events.sell'));
 const html=permissionFields('u1');
 assert.match(html,/data-access-events/);
 assert.match(html,/name="event_member"/);
 assert.doesNotMatch(html,/Encerrado/);
});
test('lojas têm checkboxes compactos e acesso avançado recolhido',()=>{
 const html=permissionFields('u1');
 assert.equal((html.match(/name="store"/g)||[]).length,3);
 assert.match(html,/value="s1" checked/);
 assert.match(html,/<details class="um-advanced"/);
});
test('usuários possuem editar, excluir, restaurar e filtros',()=>{
 assert.match(view,/data-users-search/);
 assert.match(view,/data-users-filter-role/);
 assert.match(view,/user-edit/);
 assert.match(view,/user-delete/);
 assert.match(view,/user-restore/);
 assert.match(view,/u\.id===state\.user\?\.id/);
});
test('editor mantém papel escolhido e usa rotina transacional',()=>{
 assert.match(code,/set_staff_access_v2/);
 assert.match(code,/invokeManageUser\('archive'/);
 assert.match(code,/invokeManageUser\('restore'/);
 assert.match(code,/invokeManageUser\('edit'/);
});
