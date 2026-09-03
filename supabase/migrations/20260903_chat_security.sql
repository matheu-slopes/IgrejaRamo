-- Protege o chat no banco. As escritas sensiveis passam pelas APIs com service role.

CREATE OR REPLACE FUNCTION public.chat_is_member(p_conversa_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = p_conversa_id AND cp.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_can_manage(p_conversa_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.chat_conversas cc
      WHERE cc.id = p_conversa_id AND cc.admin_id = p_user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.perfis p
      WHERE p.id = p_user_id AND p.role::text IN ('admin', 'pastor')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.chat_is_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_can_manage(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_is_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_manage(UUID, UUID) TO authenticated;

ALTER TABLE public.chat_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas: políticas permissivas se somam, portanto manter uma
-- regra antiga aberta tornaria as novas regras ineficazes.
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('chat_conversas', 'chat_participantes', 'chat_mensagens')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS chat_conversas_select_member ON public.chat_conversas;
DROP POLICY IF EXISTS chat_conversas_update_manager ON public.chat_conversas;
DROP POLICY IF EXISTS chat_conversas_delete_manager ON public.chat_conversas;
CREATE POLICY chat_conversas_select_member ON public.chat_conversas
  FOR SELECT TO authenticated USING (public.chat_is_member(id));
CREATE POLICY chat_conversas_update_manager ON public.chat_conversas
  FOR UPDATE TO authenticated USING (public.chat_can_manage(id)) WITH CHECK (public.chat_can_manage(id));
CREATE POLICY chat_conversas_delete_manager ON public.chat_conversas
  FOR DELETE TO authenticated USING (public.chat_can_manage(id));

DROP POLICY IF EXISTS chat_participantes_select_member ON public.chat_participantes;
DROP POLICY IF EXISTS chat_participantes_update_self ON public.chat_participantes;
DROP POLICY IF EXISTS chat_participantes_delete_self_or_manager ON public.chat_participantes;
CREATE POLICY chat_participantes_select_member ON public.chat_participantes
  FOR SELECT TO authenticated USING (public.chat_is_member(conversa_id));
CREATE POLICY chat_participantes_update_self ON public.chat_participantes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY chat_participantes_delete_self_or_manager ON public.chat_participantes
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.chat_can_manage(conversa_id));

DROP POLICY IF EXISTS chat_mensagens_select_member ON public.chat_mensagens;
CREATE POLICY chat_mensagens_select_member ON public.chat_mensagens
  FOR SELECT TO authenticated USING (public.chat_is_member(conversa_id));

-- Cursores podem ser observados pelos participantes para os indicadores de entregue/lido.
DO $$
DECLARE policy_row RECORD;
BEGIN
  IF to_regclass('public.chat_participante_cursors') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.chat_participante_cursors ENABLE ROW LEVEL SECURITY';
    FOR policy_row IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'chat_participante_cursors'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_participante_cursors', policy_row.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY chat_cursors_select_member ON public.chat_participante_cursors
      FOR SELECT TO authenticated USING (public.chat_is_member(conversa_id))';
  END IF;
END $$;

-- Tabelas internas da fila nunca ficam acessiveis pelo navegador.
DO $$
BEGIN
  IF to_regclass('public.chat_notification_jobs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.chat_notification_jobs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.chat_notification_jobs FROM anon, authenticated';
  END IF;
END $$;
