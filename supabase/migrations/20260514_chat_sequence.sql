-- Monotonic sequence cursor for chat sync.
-- Run once after public.chat_mensagens already exists.

ALTER TABLE public.chat_mensagens
  ADD COLUMN sequence_id BIGINT;

CREATE SEQUENCE public.chat_mensagens_sequence_id_seq;

ALTER SEQUENCE public.chat_mensagens_sequence_id_seq
  OWNED BY public.chat_mensagens.sequence_id;

ALTER TABLE public.chat_mensagens
  ALTER COLUMN sequence_id SET DEFAULT nextval('public.chat_mensagens_sequence_id_seq');

WITH current_base AS (
  SELECT COALESCE(MAX(sequence_id), 0) AS base_sequence
  FROM public.chat_mensagens
),
ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY criado_em, id) AS rn
  FROM public.chat_mensagens
  WHERE sequence_id IS NULL
)
UPDATE public.chat_mensagens m
SET sequence_id = current_base.base_sequence + ordered.rn
FROM ordered, current_base
WHERE m.id = ordered.id;

SELECT setval(
  'public.chat_mensagens_sequence_id_seq',
  GREATEST(
    COALESCE((SELECT MAX(sequence_id) FROM public.chat_mensagens), 0),
    1
  ),
  true
);

ALTER TABLE public.chat_mensagens
  ALTER COLUMN sequence_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_mensagens_sequence_id
  ON public.chat_mensagens (sequence_id);

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa_sequence
  ON public.chat_mensagens (conversa_id, sequence_id DESC);