-- Corrige a gravação da capa das lojas temporárias sem ampliar o acesso geral.
-- As políticas events_update e events_read já exigem events.manage ou acesso autorizado.
-- GRANT UPDATE por coluna evita liberar alterações a nome, status, datas e outros campos.
GRANT UPDATE (cover_path) ON TABLE public.events TO authenticated;

-- anon permanece sem acesso à tabela events.
-- Registros existentes, reservas e históricos não são alterados.
