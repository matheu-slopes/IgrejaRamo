-- Renomeia o valor 'Cantina' para 'Recepcionamento' no ENUM ministerio_tipo.
-- Todos os dados armazenados com esse valor são atualizados automaticamente.
-- Execute este arquivo no Supabase Dashboard → SQL Editor.

ALTER TYPE ministerio_tipo RENAME VALUE 'Cantina' TO 'Recepcionamento';

-- Adiciona 'Limpeza' ao ENUM caso ainda não exista (pode falhar silenciosamente se já existir)
DO $$
BEGIN
  ALTER TYPE ministerio_tipo ADD VALUE IF NOT EXISTS 'Limpeza';
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- Atualiza a descrição do canal
UPDATE canais_ministerio
SET descricao = 'Canal de abertura, oferta e recepção'
WHERE ministerio = 'Recepcionamento';
