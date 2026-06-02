-- Permite criar novos ministérios pelo painel admin.
-- Troca o antigo ENUM ministerio_tipo por TEXT nos campos de ministério.
-- Execute no Supabase Dashboard -> SQL Editor ou pelo fluxo de migrations do projeto.

ALTER TABLE perfis
  ALTER COLUMN ministerios TYPE TEXT[] USING ministerios::TEXT[],
  ALTER COLUMN lider_ministerios TYPE TEXT[] USING lider_ministerios::TEXT[];

ALTER TABLE eventos
  ALTER COLUMN ministerio TYPE TEXT USING ministerio::TEXT;

ALTER TABLE avisos
  ALTER COLUMN ministerios TYPE TEXT[] USING ministerios::TEXT[];

ALTER TABLE escalas
  ALTER COLUMN ministerio TYPE TEXT USING ministerio::TEXT;

ALTER TABLE mural_mensagens
  ALTER COLUMN ministerio TYPE TEXT USING ministerio::TEXT;

ALTER TABLE notificacoes
  ALTER COLUMN ministerio TYPE TEXT USING ministerio::TEXT;

ALTER TABLE canais_ministerio
  ALTER COLUMN ministerio TYPE TEXT USING ministerio::TEXT;

ALTER TABLE membros_ministerio
  ALTER COLUMN ministerio TYPE TEXT USING ministerio::TEXT;

ALTER TABLE grupos
  ALTER COLUMN ministerio TYPE TEXT USING ministerio::TEXT;
