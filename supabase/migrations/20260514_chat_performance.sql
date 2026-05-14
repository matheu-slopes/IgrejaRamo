-- Chat performance hardening for high-concurrency scenarios.
-- This migration is resilient: it creates indexes only when related tables exist.

DO $$
BEGIN
  -- Current schema used by the app
  IF to_regclass('public.chat_participantes') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_participantes_conversa_user
      ON public.chat_participantes (conversa_id, user_id)';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chat_participantes_user_conversa
      ON public.chat_participantes (user_id, conversa_id)';
  ELSE
    RAISE NOTICE 'public.chat_participantes not found. Skipping chat_participantes indexes.';
  END IF;

  IF to_regclass('public.chat_mensagens') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa_criado
      ON public.chat_mensagens (conversa_id, criado_em DESC)';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chat_mensagens_criado
      ON public.chat_mensagens (criado_em DESC)';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa_autor
      ON public.chat_mensagens (conversa_id, autor_id)';
  ELSE
    RAISE NOTICE 'public.chat_mensagens not found. Skipping chat_mensagens indexes.';
  END IF;

  -- Legacy schema fallback (older project versions)
  IF to_regclass('public.mensagens') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_criado
      ON public.mensagens (conversa_id, criado_em DESC)';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mensagens_criado
      ON public.mensagens (criado_em DESC)';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_autor
      ON public.mensagens (conversa_id, autor_id)';
  END IF;

  IF to_regclass('public.conversas_diretas') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversas_diretas_participantes
      ON public.conversas_diretas (participante_a, participante_b)';
  END IF;
END $$;
