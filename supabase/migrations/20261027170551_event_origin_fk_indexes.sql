begin;
create index if not exists event_branch_stock_reservations_product_idx
  on public.event_branch_stock_reservations(product_id);
create index if not exists event_stock_sources_product_idx
  on public.event_stock_sources(product_id);
create index if not exists event_stock_sources_source_store_idx
  on public.event_stock_sources(source_store_id);
commit;
