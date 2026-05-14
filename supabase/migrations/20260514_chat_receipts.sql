-- Message receipts for stronger chat consistency (sent/delivered/read)

CREATE TABLE IF NOT EXISTS public.chat_message_receipts (
  message_id UUID NOT NULL REFERENCES public.chat_mensagens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_receipts_user_read
  ON public.chat_message_receipts (user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_chat_receipts_user_delivered
  ON public.chat_message_receipts (user_id, delivered_at);

CREATE INDEX IF NOT EXISTS idx_chat_receipts_message
  ON public.chat_message_receipts (message_id);
