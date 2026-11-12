-- Liderança e permissões delegadas são sempre verificadas no ministério.
-- Campos que concedem acesso só podem ser alterados por operações autorizadas
-- no servidor; editar o próprio nome ou telefone continua disponível.
CREATE OR REPLACE FUNCTION public.proteger_acessos_perfil_canal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() = 'authenticated' AND (
    (TG_OP = 'INSERT' AND (NEW.role::text <> 'membro' OR COALESCE(cardinality(NEW.ministerios), 0) > 0 OR COALESCE(cardinality(NEW.lider_ministerios), 0) > 0 OR COALESCE(cardinality(NEW.permissoes), 0) > 0 OR NEW.ativo IS DISTINCT FROM true)) OR
    (TG_OP = 'UPDATE' AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.ministerios IS DISTINCT FROM OLD.ministerios OR NEW.lider_ministerios IS DISTINCT FROM OLD.lider_ministerios OR NEW.permissoes IS DISTINCT FROM OLD.permissoes OR NEW.ativo IS DISTINCT FROM OLD.ativo))
  ) THEN RAISE EXCEPTION 'Campos de acesso devem ser alterados pelo servidor'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proteger_acessos_perfil_canal ON public.perfis;
CREATE TRIGGER proteger_acessos_perfil_canal BEFORE INSERT OR UPDATE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.proteger_acessos_perfil_canal();

CREATE OR REPLACE FUNCTION public.eh_lider_ministerio(p_user uuid, p_ministerio text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = p_user AND p.ativo = true AND (
    p.role::text IN ('admin', 'pastor') OR p_ministerio = ANY(COALESCE(p.lider_ministerios, ARRAY[]::text[])) OR EXISTS (
      SELECT 1 FROM public.membros_ministerio m WHERE m.usuario_id = p.id AND m.ministerio = p_ministerio
      AND COALESCE(m.ativo, true) AND m.funcao::text IN ('Líder', 'Colíder')
      AND p_ministerio = ANY(COALESCE(p.ministerios, ARRAY[]::text[]))
    )
  ));
$$;

CREATE OR REPLACE FUNCTION public.pertence_ministerio(p_user uuid, p_ministerio text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.eh_lider_ministerio(p_user, p_ministerio) OR EXISTS (
    SELECT 1 FROM public.perfis p WHERE p.id = p_user AND p.ativo = true
      AND p_ministerio = ANY(COALESCE(p.ministerios, ARRAY[]::text[]))
  );
$$;

CREATE OR REPLACE FUNCTION public.tem_permissao_ministerio(p_user uuid, p_ministerio text, p_permissao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.eh_lider_ministerio(p_user, p_ministerio) OR EXISTS (
    SELECT 1 FROM public.perfis p LEFT JOIN public.membros_ministerio m ON m.usuario_id = p.id AND m.ministerio = p_ministerio
    WHERE p.id = p_user AND p.ativo = true AND p_ministerio = ANY(COALESCE(p.ministerios, ARRAY[]::text[]))
      AND (p_permissao = ANY(COALESCE(p.permissoes, ARRAY[]::text[])) OR
        (m.id IS NOT NULL AND COALESCE(m.ativo, true) AND p_permissao = ANY(COALESCE(m.permissoes_canal, ARRAY[]::text[]))))
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_repertorio_louvor(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.tem_permissao_ministerio(p_user, 'Louvor', 'gerenciar_repertorio');
$$;

-- Registros antigos de coliderança passam a aparecer também no perfil.
UPDATE public.perfis p SET lider_ministerios = ARRAY(
  SELECT DISTINCT liderancas.nome FROM (
    SELECT unnest(COALESCE(p.lider_ministerios, ARRAY[]::text[])) AS nome
    UNION ALL SELECT m.ministerio FROM public.membros_ministerio m
      WHERE m.usuario_id = p.id AND m.funcao::text IN ('Líder', 'Colíder')
        AND m.ministerio = ANY(COALESCE(p.ministerios, ARRAY[]::text[]))
  ) liderancas
) WHERE EXISTS (SELECT 1 FROM public.membros_ministerio m WHERE m.usuario_id = p.id AND m.funcao::text IN ('Líder', 'Colíder') AND m.ministerio = ANY(COALESCE(p.ministerios, ARRAY[]::text[])));

INSERT INTO public.membros_ministerio (usuario_id, ministerio, funcao)
SELECT p.id, lideranca.nome_ministerio, 'Líder'::public.funcao_ministerio FROM public.perfis p
CROSS JOIN LATERAL unnest(COALESCE(p.lider_ministerios, ARRAY[]::text[])) AS lideranca(nome_ministerio)
WHERE lideranca.nome_ministerio = ANY(COALESCE(p.ministerios, ARRAY[]::text[]))
ON CONFLICT (usuario_id, ministerio) DO UPDATE SET funcao = CASE WHEN public.membros_ministerio.funcao::text = 'Colíder' THEN public.membros_ministerio.funcao ELSE EXCLUDED.funcao END;

-- O painel do administrador e a aba Membros usam a mesma liderança.
CREATE OR REPLACE FUNCTION public.sincronizar_lideranca_ministerio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE nome text;
BEGIN
  FOREACH nome IN ARRAY COALESCE(OLD.lider_ministerios, ARRAY[]::text[]) LOOP
    IF NOT nome = ANY(COALESCE(NEW.lider_ministerios, ARRAY[]::text[])) THEN
      UPDATE public.membros_ministerio SET funcao = 'Voluntário(a)' WHERE usuario_id = NEW.id AND ministerio = nome AND funcao::text IN ('Líder', 'Colíder');
    END IF;
  END LOOP;
  FOREACH nome IN ARRAY COALESCE(NEW.lider_ministerios, ARRAY[]::text[]) LOOP
    IF NOT nome = ANY(COALESCE(OLD.lider_ministerios, ARRAY[]::text[])) AND nome = ANY(COALESCE(NEW.ministerios, ARRAY[]::text[])) THEN
      INSERT INTO public.membros_ministerio (usuario_id, ministerio, funcao) VALUES (NEW.id, nome, 'Líder')
        ON CONFLICT (usuario_id, ministerio) DO UPDATE SET funcao = CASE WHEN public.membros_ministerio.funcao::text = 'Colíder' THEN public.membros_ministerio.funcao ELSE EXCLUDED.funcao END;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sincronizar_lideranca_ministerio ON public.perfis;
CREATE TRIGGER sincronizar_lideranca_ministerio AFTER UPDATE OF lider_ministerios ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_lideranca_ministerio();

-- Bloqueia a alteração direta das configurações por quem não é líder.
CREATE OR REPLACE FUNCTION public.proteger_chat_ministerio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NEW.chat_bloqueado IS DISTINCT FROM OLD.chat_bloqueado
    AND NOT public.eh_lider_ministerio(auth.uid(), OLD.ministerio) THEN
    RAISE EXCEPTION 'Somente a liderança pode alterar o chat';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proteger_chat_ministerio ON public.canais_ministerio;
CREATE TRIGGER proteger_chat_ministerio BEFORE UPDATE ON public.canais_ministerio
FOR EACH ROW EXECUTE FUNCTION public.proteger_chat_ministerio();

-- Bloqueia inclusão direta que tente contornar o fechamento do chat.
CREATE OR REPLACE FUNCTION public.proteger_envio_mural() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE fechado boolean;
BEGIN
  IF auth.role() IN ('authenticated', 'service_role') THEN
    IF (auth.role() = 'authenticated' AND NEW.autor_id IS DISTINCT FROM auth.uid()) OR NOT public.pertence_ministerio(NEW.autor_id, NEW.ministerio) THEN
      RAISE EXCEPTION 'Sem acesso ao chat do ministério';
    END IF;
    SELECT c.chat_bloqueado INTO fechado FROM public.canais_ministerio c WHERE c.ministerio = NEW.ministerio FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Chat não encontrado'; END IF;
    IF COALESCE(fechado, false) AND NOT public.eh_lider_ministerio(NEW.autor_id, NEW.ministerio) THEN
      RAISE EXCEPTION 'Chat fechado para mensagens';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proteger_envio_mural ON public.mural_mensagens;
CREATE TRIGGER proteger_envio_mural BEFORE INSERT ON public.mural_mensagens
FOR EACH ROW EXECUTE FUNCTION public.proteger_envio_mural();

CREATE OR REPLACE FUNCTION public.proteger_edicao_mural() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NOT public.pertence_ministerio(auth.uid(), OLD.ministerio)
      OR NEW.autor_id IS DISTINCT FROM OLD.autor_id OR NEW.ministerio IS DISTINCT FROM OLD.ministerio THEN
      RAISE EXCEPTION 'Sem acesso à mensagem';
    END IF;
    IF NEW.fixada IS DISTINCT FROM OLD.fixada AND NOT public.eh_lider_ministerio(auth.uid(), OLD.ministerio) THEN
      RAISE EXCEPTION 'Somente a liderança pode fixar mensagens';
    END IF;
    IF (NEW.conteudo IS DISTINCT FROM OLD.conteudo OR NEW.editado_em IS DISTINCT FROM OLD.editado_em)
      AND OLD.autor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Somente o autor pode editar'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proteger_edicao_mural ON public.mural_mensagens;
CREATE TRIGGER proteger_edicao_mural BEFORE UPDATE ON public.mural_mensagens
FOR EACH ROW EXECUTE FUNCTION public.proteger_edicao_mural();
DROP POLICY IF EXISTS mural_delete_canal_restrito ON public.mural_mensagens;
CREATE POLICY mural_delete_canal_restrito ON public.mural_mensagens AS RESTRICTIVE FOR DELETE TO authenticated USING (public.pertence_ministerio(auth.uid(), ministerio));

-- Delegações não podem ser atribuídas diretamente por clientes.
CREATE OR REPLACE FUNCTION public.proteger_delegacoes_ministerio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() = 'authenticated' AND (
    (TG_OP = 'INSERT' AND COALESCE(cardinality(NEW.permissoes_canal), 0) > 0) OR
    (TG_OP = 'UPDATE' AND NEW.permissoes_canal IS DISTINCT FROM OLD.permissoes_canal)
  ) THEN RAISE EXCEPTION 'Use a gestão de permissões do ministério'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proteger_delegacoes_ministerio ON public.membros_ministerio;
CREATE TRIGGER proteger_delegacoes_ministerio BEFORE INSERT OR UPDATE ON public.membros_ministerio
FOR EACH ROW EXECUTE FUNCTION public.proteger_delegacoes_ministerio();

-- Operações administrativas de membros passam pelo servidor autorizado.
DROP POLICY IF EXISTS membros_canal_insert_restrito ON public.membros_ministerio;
CREATE POLICY membros_canal_insert_restrito ON public.membros_ministerio AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS membros_canal_update_restrito ON public.membros_ministerio;
CREATE POLICY membros_canal_update_restrito ON public.membros_ministerio AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS membros_canal_delete_restrito ON public.membros_ministerio;
CREATE POLICY membros_canal_delete_restrito ON public.membros_ministerio AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- As permissões de eventos e escalas também são exigidas nas gravações diretas.
DROP POLICY IF EXISTS eventos_canal_insert_restrito ON public.eventos;
CREATE POLICY eventos_canal_insert_restrito ON public.eventos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tem_permissao_ministerio(auth.uid(), ministerio, 'criar_evento'));
DROP POLICY IF EXISTS eventos_canal_update_restrito ON public.eventos;
CREATE POLICY eventos_canal_update_restrito ON public.eventos AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tem_permissao_ministerio(auth.uid(), ministerio, 'editar_evento')) WITH CHECK (public.tem_permissao_ministerio(auth.uid(), ministerio, 'editar_evento'));
DROP POLICY IF EXISTS eventos_canal_delete_restrito ON public.eventos;
CREATE POLICY eventos_canal_delete_restrito ON public.eventos AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tem_permissao_ministerio(auth.uid(), ministerio, 'editar_evento'));
DROP POLICY IF EXISTS escalas_canal_insert_restrito ON public.escalas;
CREATE POLICY escalas_canal_insert_restrito ON public.escalas AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tem_permissao_ministerio(auth.uid(), ministerio, 'criar_escala'));
DROP POLICY IF EXISTS escalas_canal_update_restrito ON public.escalas;
CREATE POLICY escalas_canal_update_restrito ON public.escalas AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tem_permissao_ministerio(auth.uid(), ministerio, 'criar_escala')) WITH CHECK (public.tem_permissao_ministerio(auth.uid(), ministerio, 'criar_escala'));
DROP POLICY IF EXISTS escalas_canal_delete_restrito ON public.escalas;
CREATE POLICY escalas_canal_delete_restrito ON public.escalas AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tem_permissao_ministerio(auth.uid(), ministerio, 'criar_escala'));
DROP POLICY IF EXISTS escala_itens_canal_insert_restrito ON public.escala_itens;
CREATE POLICY escala_itens_canal_insert_restrito ON public.escala_itens AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.escalas e WHERE e.id = escala_id AND public.tem_permissao_ministerio(auth.uid(), e.ministerio, 'criar_escala')));
DROP POLICY IF EXISTS escala_itens_canal_delete_restrito ON public.escala_itens;
CREATE POLICY escala_itens_canal_delete_restrito ON public.escala_itens AS RESTRICTIVE FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.escalas e WHERE e.id = escala_id AND public.tem_permissao_ministerio(auth.uid(), e.ministerio, 'criar_escala')));
DROP POLICY IF EXISTS escala_musicas_canal_insert_restrito ON public.escala_musicas;
CREATE POLICY escala_musicas_canal_insert_restrito ON public.escala_musicas AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.escalas e WHERE e.id = escala_id AND public.tem_permissao_ministerio(auth.uid(), e.ministerio, 'criar_escala')));
DROP POLICY IF EXISTS escala_musicas_canal_delete_restrito ON public.escala_musicas;
CREATE POLICY escala_musicas_canal_delete_restrito ON public.escala_musicas AS RESTRICTIVE FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.escalas e WHERE e.id = escala_id AND public.tem_permissao_ministerio(auth.uid(), e.ministerio, 'criar_escala')));

CREATE OR REPLACE FUNCTION public.alterar_lideranca_ministerio(p_usuario uuid, p_ministerio text, p_funcao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_funcao NOT IN ('Líder', 'Colíder', 'Ministro', 'Voluntário(a)') THEN RAISE EXCEPTION 'Função inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = p_usuario AND p_ministerio = ANY(COALESCE(p.ministerios, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'Usuário não pertence ao ministério';
  END IF;
  INSERT INTO public.membros_ministerio (usuario_id, ministerio, funcao)
    VALUES (p_usuario, p_ministerio, p_funcao::public.funcao_ministerio)
    ON CONFLICT (usuario_id, ministerio) DO UPDATE SET funcao = EXCLUDED.funcao;
  UPDATE public.perfis SET lider_ministerios = CASE
    WHEN p_funcao IN ('Líder', 'Colíder') THEN array_append(array_remove(COALESCE(lider_ministerios, ARRAY[]::text[]), p_ministerio), p_ministerio)
    ELSE array_remove(COALESCE(lider_ministerios, ARRAY[]::text[]), p_ministerio) END WHERE id = p_usuario;
END $$;
REVOKE ALL ON FUNCTION public.alterar_lideranca_ministerio(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_lideranca_ministerio(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.adicionar_membro_ministerio(p_usuario uuid, p_ministerio text, p_funcao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE mins text[];
BEGIN
  IF p_funcao NOT IN ('Líder', 'Colíder', 'Ministro', 'Voluntário(a)') THEN RAISE EXCEPTION 'Função inválida'; END IF;
  SELECT ministerios INTO mins FROM public.perfis WHERE id = p_usuario FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF NOT p_ministerio = ANY(COALESCE(mins, ARRAY[]::text[])) THEN
    UPDATE public.perfis SET ministerios = array_append(COALESCE(ministerios, ARRAY[]::text[]), p_ministerio) WHERE id = p_usuario;
  END IF;
  INSERT INTO public.membros_ministerio (usuario_id, ministerio, funcao)
    VALUES (p_usuario, p_ministerio, p_funcao::public.funcao_ministerio)
    ON CONFLICT (usuario_id, ministerio) DO NOTHING;
  IF p_funcao IN ('Líder', 'Colíder') THEN
    UPDATE public.perfis SET lider_ministerios = array_append(array_remove(COALESCE(lider_ministerios, ARRAY[]::text[]), p_ministerio), p_ministerio) WHERE id = p_usuario;
    UPDATE public.membros_ministerio SET funcao = p_funcao::public.funcao_ministerio WHERE usuario_id = p_usuario AND ministerio = p_ministerio;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.adicionar_membro_ministerio(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adicionar_membro_ministerio(uuid, text, text) TO service_role;

-- Atualiza os controles abertos em outros aparelhos quando houver Realtime.
DO $$
DECLARE tabela text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
    FOREACH tabela IN ARRAY ARRAY['canais_ministerio', 'membros_ministerio'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tabela) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabela);
      END IF;
    END LOOP;
  END IF;
END $$;
