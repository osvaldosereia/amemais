-- Primeiro administrador: ativação única, com token forte fora do repositório.
-- O segredo original nunca é armazenado no GitHub ou em texto no banco.
begin;
create table app_private.initial_admin_gate (
  id boolean primary key default true check(id),
  token_sha256 text not null check(token_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id)
);
revoke all on app_private.initial_admin_gate from public,anon,authenticated;
insert into app_private.initial_admin_gate(id,token_sha256,expires_at)
values (true,'4dd44fe0ac05c24f57fede2b07f3d942f4d46560f4d32a05063a7fd09f779338', now() + interval '30 days');

create function public.claim_initial_admin(p_activation_code text, p_name text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_verified timestamptz;
  v_gate app_private.initial_admin_gate%rowtype;
  v_name text;
begin
  if v_user_id is null then raise exception 'Confirme seu email para continuar'; end if;
  select u.email, u.email_confirmed_at into v_email, v_verified
    from auth.users u where u.id = v_user_id;
  if v_email is null or v_verified is null then
    raise exception 'Email ainda não confirmado';
  end if;

  select * into v_gate from app_private.initial_admin_gate where id = true for update;
  if not found or v_gate.used_at is not null then
    raise exception 'Administrador inicial já ativado';
  end if;
  if now() >= v_gate.expires_at then raise exception 'Código de ativação expirado'; end if;
  if p_activation_code is null or length(p_activation_code) <> 43
     or encode(pg_catalog.sha256(pg_catalog.convert_to(p_activation_code,'UTF8')),'hex') <> v_gate.token_sha256 then
    raise exception 'Código de ativação inválido';
  end if;
  if exists(select 1 from public.staff_profiles) then
    raise exception 'O sistema já possui administradores';
  end if;
  v_name := trim(coalesce(p_name,''));
  if length(v_name) < 2 or length(v_name) > 120 then
    v_name := split_part(v_email,'@',1);
  end if;
  if length(v_name) < 2 then v_name := 'Administrador AME MAIS'; end if;

  insert into public.staff_profiles(id,full_name,email,role,active)
    values(v_user_id,v_name,v_email,'admin',true);
  update app_private.initial_admin_gate
    set used_at=now(),used_by=v_user_id where id=true;
  return true;
end;
$$;
revoke all on function public.claim_initial_admin(text,text) from public,anon;
grant execute on function public.claim_initial_admin(text,text) to authenticated;

create function public.is_initial_admin_pending()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app_private.initial_admin_gate g
     where g.id=true and g.used_at is null and g.expires_at>now()
       and not exists(select 1 from public.staff_profiles)
  );
$$;
revoke all on function public.is_initial_admin_pending() from public,anon;
grant execute on function public.is_initial_admin_pending() to authenticated;
commit;
