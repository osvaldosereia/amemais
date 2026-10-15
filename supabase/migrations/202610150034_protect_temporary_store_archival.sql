CREATE OR REPLACE FUNCTION public.delete_temporary_store(p_event_id uuid, p_code text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
 v_event public.events%rowtype;
 v_balance record;
 v_total integer := 0;
 v_cancelled integer := 0;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.role_in('admin','gerente')
    OR NOT app_private.has_permission('events.manage')
    OR NOT app_private.has_permission('events.close')
    OR NOT app_private.has_permission('events.return')
    OR NOT app_private.can_access_store((SELECT id FROM public.stores WHERE is_primary))
 THEN RAISE EXCEPTION 'Sem permissão para excluir loja temporária'; END IF;

 -- Somente o servidor valida o segredo; o hash não expõe o código ao frontend.
 IF p_code IS NULL OR
    extensions.digest(convert_to(p_code,'UTF8'),'sha256') <>
    decode('bfae46a9670a0415453d851d87abc38d634e46d8c2349624c813b1e0472c3b89','hex')
 THEN RAISE EXCEPTION 'Código de autorização inválido'; END IF;

 SELECT * INTO v_event FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Loja temporária não encontrada'; END IF;
 IF v_event.deleted_at IS NOT NULL THEN
   RAISE EXCEPTION 'Esta loja temporária já foi excluída';
 END IF;

 -- Primeiro cancelar os lotes abertos; reservas não podem reaparecer como disponíveis.
 PERFORM 1 FROM public.event_pick_batches WHERE event_id=p_event_id FOR UPDATE;
 SELECT count(*) INTO v_cancelled FROM public.event_pick_batches
 WHERE event_id=p_event_id AND status IN
  ('pendente_estoque','aguardando','em_separacao','separado');
 UPDATE public.stock_reservations SET status='liberada',ended_by=auth.uid(),ended_at=now()
 WHERE status='ativa' AND event_batch_id IN
   (SELECT id FROM public.event_pick_batches WHERE event_id=p_event_id
      AND status IN ('pendente_estoque','aguardando','em_separacao','separado'));
 UPDATE public.event_pick_batches SET status='cancelado',updated_at=now()
 WHERE event_id=p_event_id AND status IN
  ('pendente_estoque','aguardando','em_separacao','separado');

 IF EXISTS (
   SELECT 1 FROM public.stock_reservations r
   JOIN public.event_pick_batches b ON b.id=r.event_batch_id
   WHERE b.event_id=p_event_id AND r.status='ativa'
 ) THEN RAISE EXCEPTION 'Ainda há reservas ativas vinculadas à loja'; END IF;

 -- Inventários inacabados deixam de poder modificar um local excluído.
 UPDATE public.inventory_sessions SET status='cancelada',reviewed_by=auth.uid(),
   reviewed_at=now(),note='Cancelado por exclusão da loja temporária'
 WHERE location_type='temporaria' AND location_id=p_event_id
   AND status IN ('aberta','revisao');

 -- Retorna somente o estoque físico remanescente (nunca vendas/perdas já baixadas).
 FOR v_balance IN
   SELECT product_id,quantity FROM public.stock_balances
   WHERE event_id=p_event_id AND quantity>0 ORDER BY product_id FOR UPDATE
 LOOP
   INSERT INTO public.stock_balances(product_id,event_id,quantity)
   VALUES(v_balance.product_id,NULL,0) ON CONFLICT DO NOTHING;

   UPDATE public.stock_balances SET quantity=quantity+v_balance.quantity,
     updated_at=now()
   WHERE product_id=v_balance.product_id AND event_id IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'Saldo central indisponível'; END IF;

   UPDATE public.stock_balances SET quantity=quantity-v_balance.quantity,
     updated_at=now()
   WHERE product_id=v_balance.product_id AND event_id=p_event_id;

   INSERT INTO public.stock_movements
    (product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
   VALUES(v_balance.product_id,p_event_id,'devolucao',v_balance.quantity,
     v_balance.quantity,-v_balance.quantity,auth.uid(),
     'Retorno automático por exclusão de loja temporária');
   v_total:=v_total+v_balance.quantity;
 END LOOP;

 PERFORM pg_catalog.set_config('app_private.event_deletion_authorized',p_event_id::text,true);
 UPDATE public.events SET status='encerrado',closed_at=coalesce(closed_at,now()),
   closed_by=coalesce(closed_by,auth.uid()),deleted_at=now(),deleted_by=auth.uid()
 WHERE id=p_event_id;

 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('events',p_event_id::text,'TEMPORARY_STORE_DELETED',auth.uid(),
    jsonb_build_object('returned_units',v_total,'cancelled_batches',v_cancelled,
      'previous_status',v_event.status,'archived',true));
 RETURN v_total;
END;
$fn$;

-- Impede que qualquer cliente arquive por UPDATE direto sem passar pela função.
CREATE OR REPLACE FUNCTION app_private.guard_event_archival()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $guard$
BEGIN
 IF (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR
     NEW.deleted_by IS DISTINCT FROM OLD.deleted_by)
    AND coalesce(current_setting('app_private.event_deletion_authorized',true),'')<>OLD.id::text
 THEN RAISE EXCEPTION 'Arquivamento de evento permitido somente com autorização'; END IF;
 RETURN NEW;
END;
$guard$;
DROP TRIGGER IF EXISTS guard_event_archival ON public.events;
CREATE TRIGGER guard_event_archival
BEFORE UPDATE OF deleted_at,deleted_by ON public.events
FOR EACH ROW EXECUTE FUNCTION app_private.guard_event_archival();
REVOKE ALL ON FUNCTION app_private.guard_event_archival() FROM PUBLIC,anon,authenticated;
