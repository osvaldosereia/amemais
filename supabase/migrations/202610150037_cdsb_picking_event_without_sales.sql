-- Rodadas 2 e 3: separação distinta de expedição, reposição por responsável e conferência SEM vendas.
INSERT INTO public.permission_definitions(permission,module,label,sort_order)
VALUES ('orders.dispatch','orders','Confirmar saída física do CDSB',207)
ON CONFLICT(permission) DO NOTHING;
CREATE OR REPLACE FUNCTION public.dispatch_store_order(p_order uuid, p_external_reference text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_order public.store_orders%rowtype;v_item record;v_current integer;v_target_kind text;v_reserved integer;
begin
 if not app_private.has_permission('orders.dispatch') then raise exception 'Sem permissao para registrar saida';end if;
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status<>'separado' then raise exception 'Pedido ainda nao separado ou ja expedido';end if;
 if not app_private.can_access_store(v_order.from_store_id) then raise exception 'Sem acesso a origem';end if;
 if not exists(select 1 from public.stores where id=v_order.from_store_id and is_primary and active)
 then raise exception 'Origem deve ser a central';end if;
 select kind into v_target_kind from public.stores where id=v_order.to_store_id and active;
 if v_target_kind is null then raise exception 'Destino inativo';end if;
 if length(coalesce(p_external_reference,''))>120 then raise exception 'Referencia externa longa demais';end if;
 for v_item in select * from public.store_order_items where order_id=p_order order by product_id loop
   select quantity into v_current from public.stock_balances where product_id=v_item.product_id
     and event_id is null for update;
   select quantity into v_reserved from public.stock_reservations where order_id=p_order
     and product_id=v_item.product_id and status='ativa' for update;
   if v_reserved is distinct from v_item.quantity or v_current<v_item.quantity then
     raise exception 'Separacao inconsistente para %',v_item.product_id;
   end if;
   update public.stock_reservations set status='consumida',ended_at=now(),ended_by=auth.uid()
    where order_id=p_order and product_id=v_item.product_id and status='ativa';
   update public.stock_balances set quantity=quantity-v_item.quantity,updated_at=now()
    where product_id=v_item.product_id and event_id is null;
   insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
    values(v_item.product_id,null,'saida_loja',v_item.quantity,-v_item.quantity,0,auth.uid(),
      'Separacao para loja - pedido '||p_order::text);
   insert into public.store_transfer_log(order_id,store_id,product_id,delta,actor_id,operation)
    values(p_order,v_order.from_store_id,v_item.product_id,-v_item.quantity,auth.uid(),
      case when v_target_kind='franquia' then 'saida_definitiva' else 'expedicao' end);
 end loop;
 update public.store_orders set status='despachado',
     dispatched_by=auth.uid(),dispatched_at=now(),external_reference=nullif(btrim(coalesce(p_external_reference,'')),'')
 where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('store_orders',p_order::text,'DISPATCHED',auth.uid(),
   jsonb_build_object('destination_kind',v_target_kind,'external_reference',p_external_reference));
end;$function$

CREATE OR REPLACE FUNCTION public.create_event_pick_batch(p_event uuid, p_items jsonb, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events%rowtype;v_batch uuid;v_seq integer;
begin
 if auth.uid() is null OR not (
   (app_private.role_in('admin','gerente') AND app_private.has_permission('events.separate'))
   OR (app_private.has_permission('events.request') AND app_private.event_role(p_event,'responsavel','operador'))
 ) THEN raise exception 'Sem permissão para solicitar produtos deste evento'; END IF;
 select * into e from public.events where id=p_event for update;
 if not found or e.status not in ('rascunho','ativo') then raise exception 'Local não aceita novos lotes';end if;
 if length(coalesce(p_note,''))>180 then raise exception 'Observação muito longa';end if;
 select coalesce(max(sequence),0)+1 into v_seq from public.event_pick_batches where event_id=p_event;
 insert into public.event_pick_batches(event_id,sequence,created_by,note)
 values(p_event,v_seq,auth.uid(),nullif(btrim(coalesce(p_note,'')),'')) returning id into v_batch;
 perform app_private.set_event_batch_lines(v_batch,p_items);
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'EVENT_BATCH_CREATED',auth.uid(),
 jsonb_build_object('batch',v_batch,'sequence',v_seq));
 return v_batch;
end;$function$

CREATE OR REPLACE FUNCTION public.save_event_settlement(p_event uuid, p_items jsonb, p_note text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events%rowtype;v jsonb;v_id uuid;v_expected integer;
 v_good integer;v_sold integer;v_damaged integer;v_lost integer;
 v_count integer:=0;v_seen uuid[]:='{}';v_note text:=btrim(coalesce(p_note,''));
begin
 if auth.uid() is null or not app_private.has_permission('events.close') or not
 (app_private.has_permission('events.manage') or app_private.event_role(p_event,'responsavel'))
 then raise exception 'Sem autorização para conferência';end if;
 select * into e from public.events where id=p_event for update;
 if not found or e.status<>'ativo' then raise exception 'Loja temporária não está ativa';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>150
 then raise exception 'Conferência inválida';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v)<>'object' or coalesce(v->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
  or coalesce(v->>'expected','') !~ '^(0|[1-9][0-9]{0,6})$'
  or coalesce(v->>'good','') !~ '^(0|[1-9][0-9]{0,6})$'
  or coalesce(v->>'sold','') !~ '^(0|[1-9][0-9]{0,6})$'
  or coalesce(v->>'damaged','') !~ '^(0|[1-9][0-9]{0,6})$'
  or coalesce(v->>'lost','') !~ '^(0|[1-9][0-9]{0,6})$'
  then raise exception 'SKU ou quantidades inválidas';end if;
  v_id:=(v->>'product_id')::uuid;
  if v_id=any(v_seen) then raise exception 'SKU repetido';end if;
  v_seen:=array_append(v_seen,v_id);
  v_expected:=(v->>'expected')::integer;
  v_good:=(v->>'good')::integer;v_sold:=(v->>'sold')::integer;
  v_damaged:=(v->>'damaged')::integer;v_lost:=(v->>'lost')::integer;
  if v_sold<>0 then raise exception 'CDSB não registra vendas de eventos';end if;
  if v_good+v_sold+v_damaged+v_lost>v_expected then raise exception 'Quantidade maior que o saldo no local';end if;
  if (v_damaged>0 or v_lost>0) and length(v_note) not between 5 and 250
  then raise exception 'Informe justificativa para avarias/perdas';end if;
  if not exists(select 1 from public.stock_balances where product_id=v_id and event_id=p_event and quantity=v_expected and quantity>0)
  then raise exception 'Saldo alterado; atualize conferência';end if;
  v_count:=v_count+1;
 end loop;
 insert into public.event_settlement_drafts(event_id,items,note,saved_by)
 values(p_event,p_items,nullif(v_note,''),auth.uid())
 on conflict(event_id) do update set items=excluded.items,note=excluded.note,
 saved_by=excluded.saved_by,saved_at=now() where public.event_settlement_drafts.status='rascunho';
 if not found then raise exception 'Conferência já concluída';end if;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'SETTLEMENT_DRAFT_SAVED',auth.uid(),jsonb_build_object('sku_count',v_count));
 return v_count;
end;$function$

CREATE OR REPLACE FUNCTION public.finalize_event_settlement(p_event uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events%rowtype;d public.event_settlement_drafts%rowtype;
 v jsonb;v_id uuid;v_expected integer;v_good integer;v_sold integer;
 v_damaged integer;v_lost integer;v_count integer;v_current integer;
begin
 if auth.uid() is null or not app_private.has_permission('events.close') or not app_private.has_permission('events.manage')
 then raise exception 'Sem autorização para fechar';end if;
 select * into e from public.events where id=p_event for update;
 if not found or e.status<>'ativo' then raise exception 'Loja não está ativa';end if;
 select * into d from public.event_settlement_drafts where event_id=p_event for update;
 if not found or d.status<>'rascunho' then raise exception 'Salve a conferência primeiro';end if;
 select count(*) into v_count from public.stock_balances where event_id=p_event and quantity>0;
 if v_count<>jsonb_array_length(d.items) then raise exception 'A conferência precisa incluir todos os SKUs pendentes';end if;
 -- Valida toda a conferência antes de movimentar a primeira unidade.
 for v in select value from jsonb_array_elements(d.items) order by value->>'product_id' loop
  v_id:=(v->>'product_id')::uuid;v_expected:=(v->>'expected')::integer;
  v_good:=(v->>'good')::integer;v_sold:=(v->>'sold')::integer;
  v_damaged:=(v->>'damaged')::integer;v_lost:=(v->>'lost')::integer;
  select quantity into v_current from public.stock_balances where event_id=p_event and product_id=v_id;
  if v_current is distinct from v_expected or v_expected<>v_good+v_sold+v_damaged+v_lost
  then raise exception 'Diferença pendente ou saldo alterado no SKU %',v_id;end if;
 end loop;
 for v in select value from jsonb_array_elements(d.items) order by value->>'product_id' loop
  v_id:=(v->>'product_id')::uuid;
  v_good:=(v->>'good')::integer;v_sold:=(v->>'sold')::integer;
  v_damaged:=(v->>'damaged')::integer;v_lost:=(v->>'lost')::integer;
  if v_sold<>0 then raise exception 'A conferência não pode registrar vendas'; end if;
  if v_good>0 then perform public.move_stock(v_id,'devolucao',v_good,p_event,'Fechamento da loja · devolução de produtos bons');end if;
  -- Não registramos vendas em eventos; somente quantidades não devolvidas.
  if v_lost>0 then perform public.record_event_loss(p_event,v_id,v_lost,'outro',coalesce(d.note,'Quantidade não devolvida na conferência'));end if;
  if v_damaged>0 then
   perform public.record_event_loss(p_event,v_id,v_damaged,'avaria',coalesce(d.note,'Avaria conferida'));
   insert into public.stock_damages(product_id,origin_event_id,quantity,note,created_by)
   values(v_id,p_event,v_damaged,coalesce(d.note,'Avaria informada'),auth.uid());
  end if;
 end loop;
 perform public.close_event(p_event);
 update public.event_settlement_drafts set status='concluido',finalized_by=auth.uid(),finalized_at=now()
 where event_id=p_event;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'SETTLEMENT_FINALIZED',auth.uid(),
 jsonb_build_object('items',d.items,'note',d.note));
end;$function$

-- Nova confirmação de entrega SEM estoque no destino (Loja Cristo Rei e franquias).
CREATE OR REPLACE FUNCTION public.confirm_commercial_order_delivery(p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_order public.store_orders%rowtype;
BEGIN
 SELECT * INTO v_order FROM public.store_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR v_order.status<>'despachado' THEN RAISE EXCEPTION 'Pedido não está aguardando entrega';END IF;
 IF NOT app_private.can_access_store(v_order.to_store_id) OR NOT
   (app_private.has_permission('orders.franchise') OR app_private.has_permission('orders.receive'))
 THEN RAISE EXCEPTION 'Sem permissão para confirmar esta entrega';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stores WHERE id=v_order.to_store_id AND kind='franquia' AND active)
 THEN RAISE EXCEPTION 'Esta confirmação é somente para lojas sem controle interno de estoque';END IF;
 UPDATE public.store_orders SET status='recebido',received_by=auth.uid(),received_at=now() WHERE id=p_order;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('store_orders',p_order::text,'DELIVERY_CONFIRMED',auth.uid(),
  jsonb_build_object('destination',v_order.to_store_id,'no_internal_stock',true));
END;$fn$;
REVOKE ALL ON FUNCTION public.confirm_commercial_order_delivery(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_commercial_order_delivery(uuid) TO authenticated;
-- Impede novas movimentações classificadas como venda dentro de eventos.
CREATE OR REPLACE FUNCTION app_private.reject_event_sales()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NEW.action='venda_evento' THEN RAISE EXCEPTION
 'O CDSB não registra vendas: confira somente envios, devoluções, avarias e não devolvidos'; END IF;
 RETURN NEW;
END;$fn$;
DROP TRIGGER IF EXISTS cdsb_no_event_sales ON public.stock_movements;
CREATE TRIGGER cdsb_no_event_sales BEFORE INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION app_private.reject_event_sales();
