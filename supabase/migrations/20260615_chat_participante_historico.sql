-- Controls how far back each participant can see messages in a conversation.
-- NULL means full history; a timestamp means only messages from that moment on.

ALTER TABLE public.chat_participantes
  ADD COLUMN IF NOT EXISTS historico_desde TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_participantes_user_historico
  ON public.chat_participantes (user_id, conversa_id, historico_desde);
