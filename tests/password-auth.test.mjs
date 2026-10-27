import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/app.js'),login=read('supabase/functions/username-login/index.ts');
const admin=read('supabase/functions/admin-create-user/index.ts');
test('A opção de login por email antigo realmente alterna os formulários',()=>{
 assert.match(app,/const legacy=state\.loginMode==='link'/);
 assert.match(app,/field\('Email da conta antiga','email','email'/);
 assert.match(app,/data-action="forgot"/);
 assert.match(app,/if\(type==='login-link'\)/);
 assert.doesNotMatch(app,/const legacy=false/);
});
test('O administrador redefine senha sem deixar email não confirmado',()=>{
 assert.match(admin,/admin\.auth\.admin\.getUserById\(targetId\)/);
 assert.match(admin,/password,email_confirm:true/);
 assert.match(admin,/!target\.active \|\| target\.archived_at/);
 assert.match(admin,/authTarget\.user\.email/);
 assert.match(admin,/PASSWORD_RESET_BY_ADMIN/);
 assert.match(admin,/https:\/\/www\.cdsb\.net\.br/);
});
test('Login diferencia limite de requisições e instabilidade sem aceitar credenciais inválidas',()=>{
 assert.match(login,/result\.error\.status===429/);
 assert.match(login,/code:'rate_limited'/);
 assert.match(login,/code:'email_not_confirmed'/);
 assert.match(login,/result\.data\.user\?\.id!==target\.id/);
 assert.match(app,/status===429/);
 assert.match(app,/FunctionsFetchError/);
});
test('Sessões repetidas não disparam carregamentos concorrentes',()=>{
 assert.match(app,/if\(profileLoading\)return profileLoading/);
 assert.match(app,/state\.user\?\.id===session\?\.user\?\.id/);
 assert.match(app,/event==='PASSWORD_RECOVERY'/);
 assert.match(app,/if\(type==='recovery-password'\)/);
 assert.match(app,/db\.auth\.updateUser\(\{password\}\)/);
});
test('Versão de cache renovada somente na entrada da aplicação',()=>{
 assert.match(read('src/secure-entry.js'),/app\.js\?v=20261027catalogrecovery1/);
 assert.match(read('index.html'),/secure-entry\.js\?v=20261027catalogrecovery1/);
});
