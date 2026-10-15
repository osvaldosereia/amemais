-- Os destinos associados a motivos padronizados não podem ser renomeados/desativados
-- acidentalmente pelo gerenciador genérico de destinos.
create or replace function app_private.protect_system_stock_destination()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if old.system_reason is not null then
  if tg_op='DELETE' then
    raise exception 'Destino reservado para baixas excepcionais não pode ser excluído';end if;
  if new.system_reason is distinct from old.system_reason
   or new.name is distinct from old.name
   or new.active is distinct from old.active
  then raise exception 'Destino reservado para baixas excepcionais não pode ser alterado';end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end;$fn$;
drop trigger if exists stock_destinations_system_protection on public.stock_destinations;
create trigger stock_destinations_system_protection
 before update or delete on public.stock_destinations
 for each row execute function app_private.protect_system_stock_destination();
