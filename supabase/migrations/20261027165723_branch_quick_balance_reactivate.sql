begin;

-- Reativa produto inativo quando o saldo físico de qualquer filial muda.
-- Mantém o saldo de cada loja em store_stock e não interfere no estoque central.
create or replace function app_private.auto_activate_product_after_store_stock_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op='UPDATE' then
    if old.quantity is not distinct from new.quantity then
      return new;
    end if;
  end if;

  perform app_private.activate_product_after_related_change(new.product_id);
  return new;
end;
$function$;

drop trigger if exists store_stock_reactivate_inactive_product on public.store_stock;
create trigger store_stock_reactivate_inactive_product
after insert or update of quantity on public.store_stock
for each row execute function app_private.auto_activate_product_after_store_stock_change();

commit;
