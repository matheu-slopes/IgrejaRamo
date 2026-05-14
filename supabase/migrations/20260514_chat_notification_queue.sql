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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_chat_notification_jobs_pending'
  ) THEN
    EXECUTE 'CREATE INDEX idx_chat_notification_jobs_pending ON public.chat_notification_jobs (status, created_at)';
  END IF;

  IF to_regclass('public.notificacoes') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notificacoes'
        AND column_name = 'chat_mensagem_id'
    ) THEN
      ALTER TABLE public.notificacoes ADD COLUMN chat_mensagem_id UUID;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'uq_notificacoes_usuario_chat_mensagem'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX uq_notificacoes_usuario_chat_mensagem ON public.notificacoes (usuario_id, chat_mensagem_id)';
    END IF;
  ELSE
    RAISE NOTICE 'public.notificacoes not found. Skipping chat notification dedupe column.';
  END IF;
END $$;