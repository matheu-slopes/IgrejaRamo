ALTER TABLE escala_itens
  ADD COLUMN IF NOT EXISTS confirmado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_escala_itens_voluntario_confirmacao
  ON escala_itens (voluntario_id, escala_id);
