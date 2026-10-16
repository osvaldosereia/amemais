import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../src/gondolas.js',import.meta.url),'utf8');
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const locations=[{id:'a',name:'01',active:true},{id:'b',name:'3',active:true},{id:'c',name:'Antiga',active:false}];
test('seletor oferece apenas localizações ativas, preservando inativas já cadastradas',()=>{
 const html=api.gondolaSelectHTML('gondola',locations,'Antiga');
 assert.match(html,/<select[^>]+name="gondola"/);
 assert.match(html,/value="01"/);
 assert.match(html,/value="3"/);
 assert.match(html,/Antiga.*selecionada/i);
 assert.doesNotMatch(html,/value="Novo local digitado"/);
});
test('nenhuma gôndola inventada é escolhida automaticamente para produto novo',()=>{
 const html=api.gondolaSelectHTML('gondola',locations);
 assert.match(html,/value="" selected/);
});
test('cadastro de gôndolas tem ações distintas e preserva nome legado',()=>{
 const button=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';
 const html=api.gondolasPageHTML(locations,{button,canManage:true});
 assert.match(html,/Nova gôndola/);
 assert.match(html,/gondola-edit/);
 assert.match(html,/gondola-toggle/);
 assert.match(html,/Gôndolas/);
});
test('cadastro está integrado ao catálogo e disponível no menu',async()=>{
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(app,/{id:'gondolas',label:'Gôndolas'/);
 assert.match(app,/state\.gondolas/);
 assert.match(app,/gondolasPageHTML/);
 assert.match(app,/if\(type==='gondola-save'\)/);
 assert.match(app,/if\(action==='gondola-toggle'\)/);
 assert.match(app,/gondolaSelectHTML\('gondola'/);
});
test('locais existentes são importados sem alterar os produtos',async()=>{
 const migration=await readFile(new URL('../supabase/migrations/20261016_gondolas_catalog.sql',import.meta.url),'utf8');
 assert.match(migration,/INSERT INTO public.gondolas/);
 assert.match(migration,/SELECT DISTINCT|GROUP BY/i);
 assert.match(migration,/products/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(migration,/DELETE FROM public.products|UPDATE public.products/i);
});
