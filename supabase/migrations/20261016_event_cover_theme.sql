-- Tema visual associado à capa; separação logística e dados do evento não são alterados.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_theme text;
COMMENT ON COLUMN public.events.cover_theme IS
  'Direção temática opcional para geração da capa da loja temporária.';
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_cover_theme_length;
ALTER TABLE public.events
  ADD CONSTRAINT events_cover_theme_length
  CHECK (cover_theme IS NULL OR char_length(cover_theme) <= 220);
