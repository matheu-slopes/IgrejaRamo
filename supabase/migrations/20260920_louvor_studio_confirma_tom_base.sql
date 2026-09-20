-- Tom que o líder confirmou como base do vídeo usado pelo Studio.
-- Ele substitui a estimativa automática quando houver divergência com a cifra.
ALTER TABLE public.louvor_studio_projetos
  ADD COLUMN IF NOT EXISTS tom_base_confirmado TEXT
    CHECK (tom_base_confirmado ~ '^[A-G](#|b)?m?$');
