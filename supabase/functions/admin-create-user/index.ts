import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Content-Type': 'application/json' };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return respond({ error: 'Método inválido' }, 405);
  try {
    const jwt = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!jwt) return respond({ error: 'Acesso negado' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const publishable = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authClient = createClient(url, publishable);
    const { data: { user }, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !user) return respond({ error: 'Sessão inválida' }, 401);
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: operator, error: operatorError } = await admin.from('staff_profiles').select('role,active').eq('id', user.id).single();
    if (operatorError || !operator?.active || operator.role !== 'admin') return respond({ error: 'Somente administradores' }, 403);
    const payload = await request.json();
    const email = String(payload.email || '').trim().toLowerCase();
    const fullName = String(payload.full_name || '').trim();
    const role = String(payload.role || 'evento');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || fullName.length > 120 ||
        !['admin','gerente','evento','consulta'].includes(role)) {
      return respond({ error: 'Informe nome, email válido e função.' }, 400);
    }
    // Um usuário que já tentou entrar via link não precisa ser duplicado.
    let existingUserId: string | null = null;
    let page = 1;
    while (page <= 10 && !existingUserId) {
      const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (listError) return respond({ error: 'Não foi possível verificar contas existentes.' }, 500);
      existingUserId = list.users.find(u => u.email?.toLowerCase() === email)?.id || null;
      if (list.users.length < 100) break;
      page++;
    }
    let userId: string;
    let invited = false;
    if (existingUserId) {
      userId = existingUserId;
    } else {
      const { data: created, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: 'https://cdsb.net.br/',
        data: { full_name: fullName }
      });
      if (inviteError || !created.user) {
        return respond({ error: inviteError?.message || 'Não foi possível enviar convite.' }, 400);
      }
      userId = created.user.id;
      invited = true;
    }
    const { error: profileError } = await admin.from('staff_profiles').insert({
      id: userId, full_name: fullName, email, role, active: true
    });
    if (profileError) {
      if (invited) await admin.auth.admin.deleteUser(userId);
      return respond({ error: profileError.code === '23505' ? 'Colaborador já cadastrado.' : 'Não foi possível configurar permissões.' }, 400);
    }
    const { error: auditError } = await admin.from('audit_log').insert({
      entity: 'staff_profiles', entity_id: userId, action: 'INVITE_USER',
      actor_id: user.id, details: { name: fullName, email, role }
    });
    if (auditError) {
      // O cadastro permanece válido, mas a criação não deve parecer totalmente auditada.
      return respond({ success: true, user_id: userId, invited, warning: 'Registro de auditoria adicional não foi salvo.' }, 201);
    }
    return respond({ success: true, user_id: userId, invited }, 201);
  } catch {
    return respond({ error: 'Erro ao criar usuário' }, 500);
  }
});