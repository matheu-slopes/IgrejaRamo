-- Novas escalas solicitam confirmacao por padrao.
ALTER TABLE public.escalas
  ALTER COLUMN confirmacao_participantes SET DEFAULT TRUE;

-- Corrige escalas atuais e futuras que foram criadas com a opcao desativada.
UPDATE public.escalas
SET confirmacao_participantes = TRUE
WHERE confirmacao_participantes IS DISTINCT FROM TRUE
  AND data >= CURRENT_DATE;

-- Garante que novos registros nunca fiquem sem uma definicao explicita.
UPDATE public.escalas
SET confirmacao_participantes = TRUE
WHERE confirmacao_participantes IS NULL;

ALTER TABLE public.escalas
  ALTER COLUMN confirmacao_participantes SET NOT NULL;
