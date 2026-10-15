-- Movimentos auditados em filiais próprias, sem afetar central, franquias ou consignações.
create table if not exists public.store_stock_movements (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id),
 product_id uuid not null references public.products(id),
 operation text not null check(operation in ('saida','ajuste')),
 previous_quantity integer not null check(previous_quantity>=0),
 quantity_delta integer not null check(quantity_delta<>0),
 new_quantity integer not null check(new_quantity>=0),
 reason text not null check(length(btrim(reason)) between 5 and 250),
 actor_id uuid not null references public.staff_profiles(id),
 created_at timestamptz not null default now(),
 constraint store_stock_movement_math check(new_quantity=previous_quantity+quantity_delta)
);
create index if not exists store_stock_movements_store_date_idx on public.store_stock_movements(store_id,created_at desc);
alter table public.store_stock_movements enable row level security;
revoke all on public.store_stock_movements from public,anon;
grant select on public.store_stock_movements to authenticated;
create policy "store_stock_movements_read" on public.store_stock_movements
 for select to authenticated using(
 app_private.has_permission('stores.read') and app_private.can_access_store(store_id)
);
create or replace function public.record_branch_stock_movement(
 p_store uuid,p_product uuid,p_operation text,p_quantity integer,p_expected integer,p_reason text)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare v_store public.stores%rowtype;v_before integer;v_after integer;v_delta integer;
begin
 if auth.uid() is null or not app_private.has_permission('stores.manage') and
    not app_private.has_permission('orders.receive')
 then raise exception 'Sem permissao para movimentar estoque da filial';end if;
 if not app_private.can_access_store(p_store) then raise exception 'Sem acesso a filial';end if;
 select * into v_store from public.stores where id=p_store for update;
 if not found or not v_store.active or v_store.kind<>'filial' or v_store.is_primary
 then raise exception 'A operacao exige filial propria ativa';end if;
 if p_operation not in ('saida','ajuste') then raise exception 'Operacao nao permitida';end if;
 if p_quantity is null or p_quantity<0 or p_quantity>1000000 or
    (p_operation='saida' and p_quantity=0) then raise exception 'Quantidade invalida';end if;
 if p_expected is null or p_expected<0 then raise exception 'Informe o saldo esperado';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 250 then raise exception 'Justificativa obrigatoria';end if;
 if not exists(select 1 from public.products where id=p_product) then raise exception 'Produto inexistente';end if;
 insert into public.store_stock(store_id,product_id,quantity) values(p_store,p_product,0) on conflict do nothing;
 select quantity into v_before from public.store_stock where store_id=p_store and product_id=p_product for update;
 if v_before<>p_expected then raise exception 'Saldo alterado por outra operacao. Atualize antes de salvar';end if;
 v_after:=case when p_operation='saida' then v_before-p_quantity else p_quantity end;
 if v_after<0 then raise exception 'Estoque insuficiente na filial';end if;
 v_delta:=v_after-v_before;
 if v_delta=0 then raise exception 'Sem diferenca para registrar';end if;
 update public.store_stock set quantity=v_after,updated_at=now() where store_id=p_store and product_id=p_product;
 insert into public.store_stock_movements(store_id,product_id,operation,previous_quantity,quantity_delta,new_quantity,reason,actor_id)
 values(p_store,p_product,p_operation,v_before,v_delta,v_after,btrim(p_reason),auth.uid());
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('store_stock',p_store::text,case when p_operation='saida' then 'BRANCH_EXIT' else 'BRANCH_COUNT' end,
 auth.uid(),jsonb_build_object('product_id',p_product,'before',v_before,'after',v_after,'reason',p_reason));
 return v_after;
end;$fn$;
revoke all on function public.record_branch_stock_movement(uuid,uuid,text,integer,integer,text) from public,anon;
grant execute on function public.record_branch_stock_movement(uuid,uuid,text,integer,integer,text) to authenticated;