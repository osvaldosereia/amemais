import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// O navegador usa somente a chave PUBLICÁVEL. A chave de serviço existe apenas aqui.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const validPassword = (password: string) => /^[0-9]{6}$/.test(password);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return respond({ error: 'Método inválido' }, 405);

  try {
    const jwt = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!jwt) return respond({ error: 'Entre novamente para continuar.' }, 401);
    const origin = request.headers.get('Origin');
    if (!['https://osvaldosereia.github.io','https://cdsb.net.br','https://www.cdsb.net.br'].includes(origin || '')) {
      return respond({ error: 'Origem não autorizada.' }, 403);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authClient = createClient(url, publicKey, { auth:{ autoRefreshToken:false, persistSession:false } });
    const { data:{ user }, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !user) return respond({ error: 'Sua sessão expirou. Faça login novamente.' }, 401);

    const admin = createClient(url, serviceKey, { auth:{ autoRefreshToken:false, persistSession:false } });
    const { data: operator, error: operatorError } = await admin.from('staff_profiles')
      .select('role,active').eq('id',user.id).single();
    if (operatorError || !operator?.active || operator.role !== 'admin') {
      return respond({ error:'Somente administradores podem cadastrar usuários e definir suas senhas.' },403);
    }
    const payload = await request.json();
    const action = String(payload?.action || 'create');
    const password = String(payload?.password || '');
    if (!validPassword(password)) {
      return respond({ error:'A nova senha deve conter exatamente 6 dígitos numéricos.' },400);
    }

    if (action === 'set-password') {
      const targetId = String(payload?.user_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(targetId)) return respond({error:'Usuário inválido.'},400);
      if (targetId === user.id) {
        return respond({error:'Altere sua própria senha pelo botão Minha senha.'},400);
      }
      const { data: target, error: targetError } = await admin.from('staff_profiles')
        .select('id,active,archived_at,email').eq('id',targetId).maybeSingle();
      if (targetError || !target) return respond({error:'Colaborador não encontrado.'},404);
      if (!target.active || target.archived_at) return respond({error:'Reative a conta antes de definir sua senha.'},400);
      const {data:authTarget,error:authLookupError}=await admin.auth.admin.getUserById(targetId);
      if (authLookupError || !authTarget?.user || authTarget.user.email?.toLowerCase()!==target.email?.toLowerCase())
        return respond({error:'Cadastro e autenticação estão inconsistentes. Revise esta conta antes de redefinir a senha.'},409);
      // Contas criadas anteriormente por link/convite podem estar sem confirmação.
      // A nova senha administrativa habilita o login imediatamente, sem email.
      const {data:updated,error:updateError} = await admin.auth.admin.updateUserById(targetId,{
        password,email_confirm:true
      });
      if (updateError || !updated?.user)
        return respond({error:'Não foi possível definir a senha no serviço de autenticação.'},400);
      const {error:auditError} = await admin.from('audit_log').insert({
        entity:'staff_profiles',entity_id:targetId,action:'PASSWORD_RESET_BY_ADMIN',
        actor_id:user.id,details:{ performed_by:'admin',activated_unconfirmed_email:!authTarget.user.email_confirmed_at }
      });
      if (auditError) console.error('Falha ao auditar redefinição de senha', auditError.code);
      return respond({ success:true, action:'set-password', confirmed:true, warning:auditError?'Senha definida, mas houve falha na auditoria.':undefined });
    }

    if (action !== 'create') return respond({error:'Operação inválida.'},400);
    const username = String(payload.username || '').trim();
    const email = username.toLowerCase() + '@login.amemais.invalid';
    const fullName = String(payload.full_name || '').trim();
    const role = String(payload.role || 'evento');
    const permissions = Array.isArray(payload.permissions) ? [...new Set(payload.permissions.map(String))] : [];
    const storeIds = Array.isArray(payload.store_ids) ? [...new Set(payload.store_ids.map(String))] : [];
    const validPermissionNames = new Set([
      'products.read','products.create','products.edit','products.delete',
      'stock.entry','stock.exit','stock.balance','stock.destinations',
      'events.read','events.request','events.manage','events.separate','events.return','events.sell','events.close',
      'orders.read','orders.internal','orders.assign','orders.central','orders.franchise',
      'orders.separate','orders.dispatch','orders.receive','orders.cancel','movements.read','movements.export','purchases.manage',
      'categories.manage','tags.manage','catalog.manage','products.share','stores.read','stores.manage','users.manage','system.force_delete'
    ]);
    if (!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username) ||
        fullName.length < 2 || fullName.length > 120 ||
        !['admin','gerente','estoquista','evento','consulta','franquia'].includes(role) ||
        permissions.length === 0 || permissions.some(p => !validPermissionNames.has(p)) ||
        storeIds.some(id => !/^[0-9a-f-]{36}$/i.test(id))) {
      return respond({error:'Informe nome, usuário de 3 a 32 caracteres e função.'},400);
    }

    if (storeIds.length) {
      const {data: activeStores,error: storesError} = await admin.from('stores')
        .select('id').in('id',storeIds).eq('active',true);
      if (storesError || (activeStores?.length ?? 0) !== storeIds.length) {
        return respond({error:'Uma ou mais lojas selecionadas não estão ativas.'},400);
      }
    }
    if (role === 'franquia') {
      const allowed = ['products.read','orders.franchise'];
      if (permissions.length !== allowed.length || !allowed.every(permission => permissions.includes(permission)) ||
          storeIds.length !== 1) {
        return respond({error:'Perfil franquia exige apenas catálogo e pedidos e uma unidade franqueada.'},400);
      }
      const {data: franchise,error:franchiseError} = await admin.from('stores')
        .select('id,kind').eq('id',storeIds[0]).eq('active',true).maybeSingle();
      if (franchiseError || franchise?.kind !== 'franquia') {
        return respond({error:'O usuário deve estar vinculado a uma franquia ativa.'},400);
      }
    }
    // Perfis explícitos: não promover automaticamente separador/consulta para gerente.
    const same=(allowed:string[])=>permissions.length===allowed.length&&
      allowed.every(x=>permissions.includes(x));
    if(role==='estoquista'){
      if(!same(['products.read','orders.read','orders.separate'])||storeIds.length!==1)
        return respond({error:'Separador precisa de acesso exclusivo à unidade CDSB e de três permissões de conferência.'},400);
      const {data:central,error:cdError}=await admin.from('stores').select('id')
        .eq('id',storeIds[0]).eq('is_primary',true).eq('active',true).maybeSingle();
      if(cdError||!central)return respond({error:'Selecione o Centro de Distribuição São Bento para o separador.'},400);
    }
    if(role==='evento'&&(!same(['products.read','events.read','events.request'])||storeIds.length))
      return respond({error:'Responsável de evento deve ter apenas catálogo e solicitações de eventos.'},400);
    if(role==='consulta'&&permissions.some(p=>![
      'products.read','orders.read','stores.read','movements.read','movements.export','events.read'
    ].includes(p)))return respond({error:'Perfil Consulta permite somente leitura.'},400);
    if(role==='gerente'&&permissions.some(p=>['users.manage','events.sell'].includes(p)))
      return respond({error:'Gerente não pode administrar usuários nem registrar vendas de eventos.'},400);
    const technicalRole=role;
    const {data: duplicate,error: duplicateError} = await admin.from('staff_profiles')
      .select('id').ilike('username',username).limit(2);
    if (duplicateError) return respond({error:'Não foi possível verificar o cadastro.'},500);
    if (duplicate?.length) return respond({error:'Este nome de usuário já está em uso. Escolha outro.'},409);

    // Admin SDK: conta habilitada e email considerado confirmado sem enviar link de confirmação.
    const { data: created, error:createError } = await admin.auth.admin.createUser({
      email, password, email_confirm:true, user_metadata:{full_name:fullName}
    });
    if (createError || !created.user) {
      if (/already|exists|registered|duplicate/i.test(createError?.message || '')) {
        return respond({error:'Este nome de usuário já está em uso.'},409);
      }
      return respond({error:createError?.message || 'Não foi possível cadastrar o usuário.'},400);
    }

    const userId=created.user.id;
    const {error: profileError} = await admin.from('staff_profiles').insert({
      id:userId,full_name:fullName,email,username,role:technicalRole,active:true,permissions_customized:true
    });
    if(profileError){
      await admin.auth.admin.deleteUser(userId);
      return respond({error:'A conta não pôde receber as permissões de acesso.'},500);
    }

    const {error:permissionsError} = await admin.from('staff_permissions').insert(
      permissions.map(permission => ({user_id:userId,permission}))
    );
    const {error:storesAssignmentError} = permissionsError || !storeIds.length
      ? {error:null} : await admin.from('staff_stores').insert(
          storeIds.map(store_id => ({user_id:userId,store_id}))
        );
    if (permissionsError || storesAssignmentError) {
      await admin.from('staff_permissions').delete().eq('user_id',userId);
      await admin.from('staff_stores').delete().eq('user_id',userId);
      await admin.from('staff_profiles').delete().eq('id',userId);
      await admin.auth.admin.deleteUser(userId);
      return respond({error:'Não foi possível concluir as permissões da nova conta.'},500);
    }
    // A auditoria da inserção de perfil é feita também por trigger no PostgreSQL.
    const {error:auditError} = await admin.from('audit_log').insert({
      entity:'staff_profiles',entity_id:userId,action:'CREATE_USER_PASSWORD',
      actor_id:user.id,details:{name:fullName,username,role,permissions,store_ids:storeIds}
    });
    if(auditError) console.error('Falha ao auditar criação de usuário',auditError.code);
    return respond({success:true,user_id:userId,warning:auditError?'Usuário criado, mas houve falha na auditoria adicional.':undefined},201);
  } catch(error) {
    console.error('Erro controlado no cadastro de usuários',error instanceof Error?error.name:'unknown');
    return respond({error:'Não foi possível concluir a operação. Tente novamente.'},500);
  }
});
