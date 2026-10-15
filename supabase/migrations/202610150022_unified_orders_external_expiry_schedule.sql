create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('ame-expirar-pedidos-externos','0 * * * *',
 $$select app_private.expire_unconfirmed_catalog_orders();$$);