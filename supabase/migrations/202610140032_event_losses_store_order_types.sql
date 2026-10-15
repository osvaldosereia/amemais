
-- Consignacao temporaria: baixas justificadas, sem fechamento automatico de saldo.
create or replace function public.record_event_loss(
 p_event_id uuid,p_product_id uuid,p_quantity integer,p_reason text,p_note text)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_event public.events%rowtype;v_balance integer;v_note text;
begin
 if not app_private.has_permission('events.close') or
   not(app_private.has_permission('events.manage') or app_private.event_role(p_event_id,'responsavel'))
 then raise exception 'Sem autorizacao para registrar perdas da loja temporaria';end if;
 if p_quantity is null or p_quantity not between 1 and 1000000
 then raise exception 'Quantidade invalida';end if;
 if p_reason not in ('perda','avaria','consumo','outro')
 then raise exception 'Classifique o motivo';end if;
 v_note:=btrim(coalesce(p_note,''));
 if length(v_note) not between 5 and 250
 then raise exception 'Justificativa obrigatoria entre 5 e 250 caracteres';end if;
 select * into v_event from public.events where id=p_event_id for update;
 if not found or v_event.status<>'ativo' then raise exception 'Loja temporaria nao esta ativa';end if;
 select quantity into v_balance from public.stock_balances
   where product_id=p_product_id and event_id=p_event_id for update;
 if v_balance is null or v_balance<p_quantity
 then raise exception 'Saldo da loja temporaria insuficiente';end if;
 update public.stock_balances set quantity=quantity-p_quantity,updated_at=now()
  where product_id=p_product_id and event_id=p_event_id;
 insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
 values(p_product_id,p_event_id,'baixa_evento',p_quantity,0,-p_quantity,auth.uid(),
  upper(p_reason)||': '||v_note);
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event_id::text,'LOSS_RECORDED',auth.uid(),
  jsonb_build_object('product_id',p_product_id,'quantity',p_quantity,'reason',p_reason,'note',v_note));
end;$fn$;
revoke all on function public.record_event_loss(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.record_event_loss(uuid,uuid,integer,text,text) to authenticated;

-- O tipo de solicitacao tem de corresponder ao destino; franquia nao possui saldo administrado.
create or replace function app_private.validate_store_order_kind()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_kind text;v_is_primary boolean;
begin
 select kind into v_kind from public.stores where id=new.to_store_id;
 select is_primary into v_is_primary from public.stores where id=new.from_store_id;
 if not coalesce(v_is_primary,false) then raise exception 'Os pedidos saem da central';end if;
 if new.request_type='franquia' and v_kind<>'franquia'
 then raise exception 'Pedidos de franquia exigem destino do tipo franquia';end if;
 if new.request_type='central' and v_kind<>'filial'
 then raise exception 'Pedido de loja exige destino do tipo filial';end if;
 return new;
end;$fn$;
drop trigger if exists validate_store_order_kind on public.store_orders;
create trigger validate_store_order_kind before insert or update of from_store_id,to_store_id,request_type
 on public.store_orders for each row execute function app_private.validate_store_order_kind();
