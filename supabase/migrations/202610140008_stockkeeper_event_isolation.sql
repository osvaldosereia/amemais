-- Estoquista não pode acessar operações de eventos, mesmo que fosse membro antes da mudança de perfil.
create or replace function app_private.event_role(p_event uuid, variadic allowed text[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.event_members m join public.staff_profiles p on p.id=m.user_id
    where m.event_id=p_event and m.user_id=(select auth.uid()) and p.active
      and p.role <> 'estoquista' and m.role = any(allowed)
  );
$$;