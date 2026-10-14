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
    const password = String(payload.password || '');
    const role = String(payload.role || 'evento');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || fullName.length > 120 ||
        password.length < 12 || !['admin','gerente','evento','consulta'].includes(role)) {
      return respond({ error: 'Informe nome, email válido, função e senha de pelo menos 12 caracteres.' }, 400);
    }
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName }
    });
    if (createError || !created.user) return respond({ error: createError?.message || 'Não foi possível criar usuário' }, 400);
    const { error: profileError } = await admin.from('staff_profiles').insert({
      id: created.user.id, full_name: fullName, email, role, active: true
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return respond({ error: 'Não foi possível configurar permissões do usuário' }, 500);
    }
    return respond({ success: true, user_id: created.user.id }, 201);
  } catch {
    return respond({ error: 'Erro ao criar usuário' }, 500);
  }
});