-- Isolamento entre eventos para responsáveis/operadores. Nenhum evento alheio é consultável.
DROP POLICY IF EXISTS events_read ON public.events;
CREATE POLICY events_read ON public.events FOR SELECT TO authenticated USING(
 app_private.has_permission('events.manage')
 OR (NOT app_private.role_in('evento','franquia') AND app_private.has_permission('events.read'))
 OR app_private.event_role(id,'responsavel','operador')
);
DROP POLICY IF EXISTS event_pick_batches_read ON public.event_pick_batches;
CREATE POLICY event_pick_batches_read ON public.event_pick_batches FOR SELECT TO authenticated USING(
 NOT app_private.role_in('franquia') AND (
  app_private.has_permission('orders.separate')
  OR app_private.has_permission('events.separate')
  OR app_private.has_permission('events.manage')
  OR (NOT app_private.role_in('evento') AND app_private.has_permission('events.read'))
  OR app_private.event_role(event_id,'responsavel','operador')
 )
);
DROP POLICY IF EXISTS event_pick_items_read ON public.event_pick_plan_items;
CREATE POLICY event_pick_items_read ON public.event_pick_plan_items FOR SELECT TO authenticated USING(
 app_private.has_permission('events.manage')
 OR (NOT app_private.role_in('evento','franquia') AND app_private.has_permission('events.read'))
 OR app_private.event_role(event_id,'responsavel','operador')
);
DROP POLICY IF EXISTS event_shipments_read ON public.event_shipments;
CREATE POLICY event_shipments_read ON public.event_shipments FOR SELECT TO authenticated USING(
 app_private.has_permission('events.manage')
 OR (NOT app_private.role_in('evento','franquia') AND app_private.has_permission('events.read'))
 OR app_private.event_role(event_id,'responsavel','operador')
);
DROP POLICY IF EXISTS event_settlement_drafts_read ON public.event_settlement_drafts;
CREATE POLICY event_settlement_drafts_read ON public.event_settlement_drafts FOR SELECT TO authenticated USING(
 app_private.has_permission('events.manage')
 OR (NOT app_private.role_in('evento','franquia') AND app_private.has_permission('events.read'))
 OR app_private.event_role(event_id,'responsavel','operador')
);
