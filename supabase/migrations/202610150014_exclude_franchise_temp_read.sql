-- Franquias nunca recebem acesso a preparação, conferência ou avarias,
-- mesmo se um vínculo legado de equipe ainda existir.
drop policy if exists event_pick_plans_read on public.event_pick_plans;
create policy event_pick_plans_read on public.event_pick_plans
 for select to authenticated using(
 not app_private.role_in('franquia') and
 (app_private.has_permission('events.read') or app_private.has_permission('events.manage')
 or app_private.event_role(event_id,'responsavel','operador')));
drop policy if exists event_pick_items_read on public.event_pick_plan_items;
create policy event_pick_items_read on public.event_pick_plan_items
 for select to authenticated using(
 not app_private.role_in('franquia') and
 (app_private.has_permission('events.read') or app_private.has_permission('events.manage')
 or app_private.event_role(event_id,'responsavel','operador')));
drop policy if exists event_shipments_read on public.event_shipments;
create policy event_shipments_read on public.event_shipments
 for select to authenticated using(
 not app_private.role_in('franquia') and
 (app_private.has_permission('events.read') or app_private.has_permission('events.manage')
 or app_private.event_role(event_id,'responsavel','operador')));
drop policy if exists event_settlement_drafts_read on public.event_settlement_drafts;
create policy event_settlement_drafts_read on public.event_settlement_drafts
 for select to authenticated using(
 not app_private.role_in('franquia') and
 (app_private.has_permission('events.read') or app_private.has_permission('events.manage')
 or app_private.event_role(event_id,'responsavel','operador')));
drop policy if exists stock_damages_read on public.stock_damages;
create policy stock_damages_read on public.stock_damages
 for select to authenticated using(
 not app_private.role_in('franquia') and
 (app_private.has_permission('stock.balance') or app_private.has_permission('events.manage')
 or (origin_event_id is not null and app_private.event_role(origin_event_id,'responsavel'))));
drop policy if exists damage_actions_read on public.stock_damage_actions;
create policy damage_actions_read on public.stock_damage_actions
 for select to authenticated using(
 not app_private.role_in('franquia') and
 exists(select 1 from public.stock_damages d where d.id=damage_id and
 (app_private.has_permission('stock.balance') or app_private.has_permission('events.manage')
 or (d.origin_event_id is not null and app_private.event_role(d.origin_event_id,'responsavel')))));
