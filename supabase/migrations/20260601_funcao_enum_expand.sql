-- Adiciona os valores 'Colíder' e 'Voluntário(a)' ao ENUM funcao_ministerio
-- Execute no Supabase Dashboard > SQL Editor

ALTER TYPE funcao_ministerio ADD VALUE IF NOT EXISTS 'Colíder';
ALTER TYPE funcao_ministerio ADD VALUE IF NOT EXISTS 'Voluntário(a)';

-- Atualiza o default da coluna para 'Voluntário(a)'
ALTER TABLE membros_ministerio
  ALTER COLUMN funcao SET DEFAULT 'Voluntário(a)';

-- Migra quem está como 'Membro' para 'Voluntário(a)'
UPDATE membros_ministerio SET funcao = 'Voluntário(a)' WHERE funcao = 'Membro';
