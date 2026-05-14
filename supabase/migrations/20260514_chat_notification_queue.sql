-- Queue chat push/in-app notifications outside the message send path.

CREATE TABLE IF NOT EXISTS public.chat_notification_jobs (
  message_id UUID PRIMARY KEY REFERENCES public.chat_mensagens(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'texto',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_notification_jobs_pending
  ON public.chat_notification_jobs (status, created_at);

ALTER TABLE public.notificacoes
  ADD chat_mensagem_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notificacoes_usuario_chat_mensagem
  ON public.notificacoes (usuario_id, chat_mensagem_id);