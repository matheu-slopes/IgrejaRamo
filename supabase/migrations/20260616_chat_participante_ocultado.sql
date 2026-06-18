-- Marks a conversation as hidden/deleted only for one participant.
-- New messages after this timestamp can make the chat visible again.

ALTER TABLE public.chat_participantes
  ADD COLUMN IF NOT EXISTS ocultado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_participantes_user_ocultado
  ON public.chat_participantes (user_id, conversa_id, ocultado_em);
