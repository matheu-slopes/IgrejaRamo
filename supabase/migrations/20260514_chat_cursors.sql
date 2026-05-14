-- Cursor-based delivery/read state per participant/conversation.
-- Safe to run multiple times. Legacy chat_message_receipts can coexist until cleanup.

CREATE TABLE IF NOT EXISTS public.chat_participante_cursors (
  conversa_id UUID NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_delivered_message_id UUID REFERENCES public.chat_mensagens(id) ON DELETE SET NULL,
  last_delivered_at TIMESTAMPTZ,
  last_read_message_id UUID REFERENCES public.chat_mensagens(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversa_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_cursors_user_updated
  ON public.chat_participante_cursors (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_cursors_conversa_updated
  ON public.chat_participante_cursors (conversa_id, updated_at DESC);