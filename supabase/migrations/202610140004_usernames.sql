-- AME MAIS: identificadores próprios (login por usuário, sem email na interface).
begin;
alter table public.staff_profiles add column if not exists username text;

with names as (
  select id, case
    when trim(full_name) ~ '^[A-Za-z][A-Za-z0-9_.-]{2,31}$' then trim(full_name)
    else 'usuario_' || left(replace(id::text,'-',''),10)
  end as candidate
  from public.staff_profiles
),
ranked as (
  select id, candidate,
    row_number() over(partition by lower(candidate) order by id) as position
  from names
)
update public.staff_profiles p set username =
  case when r.position = 1 then r.candidate
       else left(r.candidate,20) || '_' || left(replace(r.id::text,'-',''),8) end
from ranked r where p.id=r.id and p.username is null;

alter table public.staff_profiles
  add constraint staff_username_valid
  check (username ~ '^[A-Za-z][A-Za-z0-9_.-]{2,31}$');
alter table public.staff_profiles alter column username set not null;
create unique index staff_username_unique_ci on public.staff_profiles(lower(username));
-- Sem grants de escrita direta no username; apenas operações administrativas no servidor.
commit;