ALTER TABLE escala_itens
  ADD COLUMN IF NOT EXISTS confirmacao_status TEXT NOT NULL DEFAULT 'pendente';

ALTER TABLE escala_itens
  DROP CONSTRAINT IF EXISTS escala_itens_confirmacao_status_check;

ALTER TABLE escala_itens
  ADD CONSTRAINT escala_itens_confirmacao_status_check
  CHECK (confirmacao_status IN ('pendente', 'confirmado', 'recusado'));

UPDATE escala_itens
SET confirmacao_status = CASE
  WHEN confirmado = TRUE THEN 'confirmado'
  ELSE COALESCE(NULLIF(confirmacao_status, ''), 'pendente')
END;

NOTIFY pgrst, 'reload schema';
