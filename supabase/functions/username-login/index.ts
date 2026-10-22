import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// A função é pública apenas para iniciar uma sessão: exige usuário E senha,
// valida ambos com Supabase Auth e nunca permite operações administrativas.
const allowedOrigins = new Set([
  'https://osvaldosereia.github.io',
  'https://cdsb.net.br',
  'https://www.cdsb.net.br'
]);

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'null',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: cors });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!allowedOrigins.has(origin)) return reply({error:'Origem não autorizada.'},403);
  if (request.method !== 'POST') return reply({error:'Método inválido.'},405);

  const denied = () => reply({ error:'Usuário ou senha inválidos.' },401);
  const waiting = () => reply({error:'Muitas tentativas de acesso. Aguarde alguns minutos antes de tentar novamente.',code:'rate_limited'},429);
  try {
    if (Number(request.headers.get('content-length') || 0) > 4096) return denied();
    const {username,password} = await request.json();
    if (typeof username !== 'string' || typeof password !== 'string') return denied();
    const name = username.trim();
    if (!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(name) || password.length > 128 || !password) {
      return denied();
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    // O filtro server-side não expõe emails; comparação exata evita ambiguidades de ILIKE.
    const {data: candidates,error:lookupError} = await admin.from('staff_profiles')
      .select('id,email,username,active')
      .ilike('username',name)
      .limit(100);
    if (lookupError) return reply({error:'Serviço de login indisponível.'},503);
    const target = (candidates || []).find(p=>p.username?.toLowerCase()===name.toLowerCase());
    if (!target?.active) return denied();
    const auth = createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const result = await auth.auth.signInWithPassword({email:target.email,password});
    if (result.error) {
      if (result.error.status===429 || result.error.code==='over_request_rate_limit' ||
          result.error.code==='over_email_send_rate_limit') return waiting();
      if (result.error.code==='email_not_confirmed')
        return reply({error:'Esta conta ainda não foi ativada. Solicite ao administrador que redefina sua senha.',code:'email_not_confirmed'},403);
      if (result.error.status>=500) return reply({error:'Serviço de autenticação temporariamente indisponível.',code:'service_unavailable'},503);
      return denied();
    }
    if (!result.data.session || result.data.user?.id!==target.id) return denied();
    return reply({
      access_token:result.data.session.access_token,
      refresh_token:result.data.session.refresh_token
    });
  } catch (_error) {
    return reply({error:'Não foi possível completar o login. Confira a conexão e tente novamente.',code:'login_unavailable'},503);
  }
});