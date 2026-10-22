import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/app.js');
const edge=read('supabase/functions/admin-create-user/index.ts');
const provisioning=read('supabase/functions/cdsb-provision-users/index.ts');
const login=read('supabase/functions/username-login/index.ts');
test('Todos os campos novos de senha exigem PIN exatamente de seis dígitos',()=>{
 assert.equal((app.match(/minlength="6" maxlength="6" inputmode="numeric" pattern="\[0-9\]\{6\}"/g)||[]).length,8);
 assert.doesNotMatch(app,/minlength="6" maxlength="128" autocomplete="new-password"/);
 assert.match(app,/if\(!\/\^\[0-9\]\{6\}\$\/\.test\(p\)\)/);
});
test('Backend aceita somente seis dígitos ao criar e redefinir senhas',()=>{
 assert.match(edge,/const validPassword = \(password: string\) => \/\^\[0-9\]\{6\}\$\/\.test\(password\)/);
 assert.match(edge,/A nova senha deve conter exatamente 6 dígitos numéricos/);
 assert.match(edge,/action === 'set-password'/);
 assert.match(edge,/email_confirm:true/);
 const policy=/^[0-9]{6}$/;
 for(const pin of ['000001','123456','999999','004002'])assert.equal(policy.test(pin),true,pin);
 for(const other of ['1','12345','1234567','abc123','12 345','65432a'])assert.equal(policy.test(other),false,other);
});
test('Senhas anteriores mais longas continuam válidas no fluxo de entrada',()=>{
 assert.match(login,/password\.length > 128/);
 assert.match(app,/autocomplete="current-password"/);
 assert.doesNotMatch(login,/password\.length > 6/);
});
test('Provisionamento padrão utiliza seis números criptograficamente aleatórios',()=>{
 assert.match(provisioning,/crypto\.getRandomValues\(bytes\)/);
 assert.match(provisioning,/value>=250/);
 assert.match(provisioning,/digits\.length===6/);
 assert.match(provisioning,/return digits\.join\(''\)/);
});
test('Cache atualizado e nenhuma senha de produção redefinida no patch',()=>{
 assert.match(read('index.html'),/secure-entry\.js\?v=20261022pin6v1/);
 assert.match(read('src/secure-entry.js'),/app\.js\?v=20261022pin6v1/);
});
