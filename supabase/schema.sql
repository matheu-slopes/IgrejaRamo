-- ================================================================
-- RAMO CHURCH — Schema completo do Supabase
-- Execute este arquivo no Supabase Dashboard → SQL Editor
-- ================================================================

-- ──────────────────────────────────────────────────────────────
-- RESET (seguro para re-executar)
-- ──────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS mensagens            CASCADE;
DROP TABLE IF EXISTS conversas_diretas    CASCADE;
DROP TABLE IF EXISTS grupos               CASCADE;
DROP TABLE IF EXISTS membros_ministerio   CASCADE;
DROP TABLE IF EXISTS canais_ministerio    CASCADE;
DROP TABLE IF EXISTS notificacoes         CASCADE;
DROP TABLE IF EXISTS fotos_galeria        CASCADE;
DROP TABLE IF EXISTS mural_mensagens      CASCADE;
DROP TABLE IF EXISTS escala_musicas       CASCADE;
DROP TABLE IF EXISTS escala_itens         CASCADE;
DROP TABLE IF EXISTS escalas              CASCADE;
DROP TABLE IF EXISTS musicas              CASCADE;
DROP TABLE IF EXISTS busca_cache          CASCADE;
DROP TABLE IF EXISTS locais               CASCADE;
DROP TABLE IF EXISTS aviso_fixado         CASCADE;
DROP TABLE IF EXISTS avisos               CASCADE;
DROP TABLE IF EXISTS eventos              CASCADE;
DROP TABLE IF EXISTS perfis               CASCADE;

DROP TYPE IF EXISTS funcao_escala         CASCADE;
DROP TYPE IF EXISTS funcao_ministerio     CASCADE;
DROP TYPE IF EXISTS tipo_grupo            CASCADE;
DROP TYPE IF EXISTS tipo_notificacao      CASCADE;
DROP TYPE IF EXISTS tipo_mensagem         CASCADE;
DROP TYPE IF EXISTS ministerio_tipo       CASCADE;
DROP TYPE IF EXISTS role_tipo             CASCADE;

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- ──────────────────────────────────────────────────────────────
-- ENUMS
-- ──────────────────────────────────────────────────────────────
CREATE TYPE role_tipo AS ENUM ('admin', 'pastor', 'lider', 'voluntario', 'membro');

CREATE TYPE ministerio_tipo AS ENUM (
  'Ensino', 'Louvor', 'Ação Social', 'Infantil', 'Mídias', 'Recepcionamento', 'Jovens', 'Limpeza'
);

CREATE TYPE tipo_mensagem AS ENUM ('texto', 'imagem', 'audio');

CREATE TYPE tipo_notificacao AS ENUM ('aviso', 'escala', 'evento', 'ministerio', 'sistema');

CREATE TYPE tipo_grupo AS ENUM ('geral', 'lideranca', 'ministerio', 'culto', 'evento');

CREATE TYPE funcao_ministerio AS ENUM ('Líder', 'Sub-líder', 'Membro', 'Visitante');

CREATE TYPE funcao_escala AS ENUM (
  'Ministro', 'Guitarra', 'Baixo', 'Bateria', 'Teclado', 'Backing Vocal',
  'Transmissão', 'Projeção/Letras', 'Fotografia',
  'Abertura/Oferta', 'Escala de Limpeza',
  'Professora', 'Monitor'
);

-- ──────────────────────────────────────────────────────────────
-- PERFIS (ligado ao auth.users do Supabase)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE perfis (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  telefone      TEXT,
  foto          TEXT,
  role          role_tipo   NOT NULL DEFAULT 'membro',
  ministerios   TEXT[] DEFAULT '{}',
  lider_ministerios TEXT[] DEFAULT '{}',
  data_ingresso DATE        NOT NULL DEFAULT CURRENT_DATE,
  data_nascimento DATE,
  ativo         BOOLEAN     NOT NULL DEFAULT TRUE,
  primeiro_acesso BOOLEAN   NOT NULL DEFAULT FALSE,
  permissoes    TEXT[]      DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: cria perfil automaticamente ao criar usuário no auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfis (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- EVENTOS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE eventos (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT             NOT NULL,
  descricao   TEXT,
  data        DATE             NOT NULL,
  horario     TIME             NOT NULL,
  local       TEXT             NOT NULL,
  publico     BOOLEAN          NOT NULL DEFAULT FALSE,
  ministerio  TEXT,
  imagem_url  TEXT,
  criado_por  UUID             REFERENCES perfis(id),
  recorrente  BOOLEAN          DEFAULT FALSE,
  created_at  TIMESTAMPTZ      DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- AVISOS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE avisos (
  id            UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT             NOT NULL,
  conteudo      TEXT             NOT NULL,
  criado_em     TIMESTAMPTZ      DEFAULT NOW(),
  destinatarios JSONB            NOT NULL DEFAULT '"todos"',
  ministerios   TEXT[] DEFAULT '{}',
  visivel_home  BOOLEAN          NOT NULL DEFAULT false,
  criado_por    UUID             REFERENCES perfis(id) ON DELETE SET NULL
);

-- Aviso fixado no topo do dashboard (apenas 1 registro)
CREATE TABLE aviso_fixado (
  id           INT   PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  conteudo     TEXT  NOT NULL,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- LOCAIS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE locais (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      TEXT NOT NULL,
  descricao TEXT
);

-- ──────────────────────────────────────────────────────────────
-- MÚSICAS (repertório)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE musicas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       TEXT        NOT NULL,
  artista      TEXT        NOT NULL,
  tom          TEXT,
  estilo       TEXT,
  link_youtube TEXT,
  cifra        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- ESCALAS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE escalas (
  id                       UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  ministerio               TEXT             NOT NULL,
  data                     DATE             NOT NULL,
  horario                  TIME             NOT NULL,
  culto                    TEXT             NOT NULL,
  observacoes              TEXT,
  visivel                  BOOLEAN          DEFAULT FALSE,
  confirmacao_participantes BOOLEAN         DEFAULT FALSE,
  criado_por               UUID             REFERENCES perfis(id),
  created_at               TIMESTAMPTZ      DEFAULT NOW()
);

-- Itens da escala (funções + voluntários)
CREATE TABLE escala_itens (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id       UUID          NOT NULL REFERENCES escalas(id) ON DELETE CASCADE,
  funcao          funcao_escala NOT NULL,
  voluntario_id   UUID          REFERENCES perfis(id),
  voluntario_nome TEXT          NOT NULL,
  observacao      TEXT
);

-- Músicas de uma escala (com tom específico para aquele culto)
CREATE TABLE escala_musicas (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id UUID NOT NULL REFERENCES escalas(id) ON DELETE CASCADE,
  musica_id UUID REFERENCES musicas(id),
  titulo    TEXT NOT NULL,
  artista   TEXT NOT NULL,
  tom       TEXT,
  ordem     INT  DEFAULT 0
);

-- ──────────────────────────────────────────────────────────────
-- MURAL DE MENSAGENS (por ministério)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE mural_mensagens (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  ministerio  TEXT             NOT NULL,
  autor_id    UUID             REFERENCES perfis(id),
  autor_nome  TEXT             NOT NULL,
  autor_role  role_tipo        NOT NULL,
  conteudo    TEXT             NOT NULL,
  criado_em   TIMESTAMPTZ      DEFAULT NOW(),
  fixada      BOOLEAN          DEFAULT FALSE,
  tipo        tipo_mensagem    DEFAULT 'texto',
  media_url   TEXT,
  reacoes     JSONB            DEFAULT '[]',
  editado_em  TIMESTAMPTZ,
  resposta_a  JSONB            -- { id, autorNome, conteudo }
);

-- ──────────────────────────────────────────────────────────────
-- DEVOCIONAIS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE devocionais (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT        NOT NULL,
  subtitulo   TEXT,
  conteudo    TEXT        NOT NULL,
  versículo   TEXT,
  referencia  TEXT,
  imagem_url  TEXT,
  data        DATE        NOT NULL DEFAULT CURRENT_DATE,
  ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_por  UUID        REFERENCES perfis(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE devocionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devocionais_select" ON devocionais FOR SELECT USING (TRUE);
CREATE POLICY "devocionais_insert" ON devocionais FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "devocionais_update" ON devocionais FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "devocionais_delete" ON devocionais FOR DELETE USING (auth.uid() IS NOT NULL);

-- ──────────────────────────────────────────────────────────────
-- GALERIA PÚBLICA
-- ──────────────────────────────────────────────────────────────
CREATE TABLE fotos_galeria (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo  TEXT NOT NULL,
  url     TEXT NOT NULL,
  data    DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ──────────────────────────────────────────────────────────────
-- NOTIFICAÇÕES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE notificacoes (
  id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID                REFERENCES perfis(id) ON DELETE CASCADE,
  titulo      TEXT                NOT NULL,
  corpo       TEXT                NOT NULL,
  tipo        tipo_notificacao    NOT NULL,
  lida        BOOLEAN             DEFAULT FALSE,
  criada_em   TIMESTAMPTZ         DEFAULT NOW(),
  link        TEXT,
  ministerio  TEXT
);

-- ──────────────────────────────────────────────────────────────
-- CANAIS DE MINISTÉRIO
-- ──────────────────────────────────────────────────────────────
CREATE TABLE canais_ministerio (
  ministerio     TEXT PRIMARY KEY,
  descricao      TEXT,
  chat_bloqueado BOOLEAN DEFAULT FALSE,
  cor            TEXT    NOT NULL DEFAULT 'vine'
);

-- Popula os canais padrão
INSERT INTO canais_ministerio (ministerio, descricao, cor) VALUES
  ('Ensino',      'Canal do ministério de ensino e doutrina',    'sky'),
  ('Louvor',      'Canal do ministério de louvor e adoração',    'grape'),
  ('Ação Social', 'Canal de ação social e evangelismo',          'olive'),
  ('Infantil',    'Canal do ministério infantil',                'amber'),
  ('Mídias',      'Canal do ministério de mídias e transmissão', 'cyan'),
  ('Recepcionamento', 'Canal de abertura, oferta e recepção',     'orange'),
  ('Jovens',      'Canal do ministério de jovens',               'vine');

-- ──────────────────────────────────────────────────────────────
-- MEMBROS DE MINISTÉRIO
-- ──────────────────────────────────────────────────────────────
CREATE TABLE membros_ministerio (
  id               UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID               NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  ministerio       TEXT               NOT NULL,
  funcao           funcao_ministerio  NOT NULL DEFAULT 'Membro',
  ativo            BOOLEAN            DEFAULT TRUE,
  data_entrada     DATE               DEFAULT CURRENT_DATE,
  permissoes_canal TEXT[]             DEFAULT '{}',
  UNIQUE(usuario_id, ministerio)
);

-- ──────────────────────────────────────────────────────────────
-- GRUPOS DE CHAT
-- ──────────────────────────────────────────────────────────────
CREATE TABLE grupos (
  id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT            NOT NULL,
  tipo         tipo_grupo      NOT NULL,
  emoji        TEXT            NOT NULL DEFAULT '💬',
  cor          TEXT            NOT NULL DEFAULT 'bg-gray-700',
  descricao    TEXT,
  ministerio   TEXT,
  evento_id    UUID            REFERENCES eventos(id),
  data         DATE,
  horario      TIME,
  somente_admin BOOLEAN        DEFAULT FALSE,
  admin_id     UUID            REFERENCES perfis(id),
  institucional BOOLEAN        DEFAULT FALSE,
  membros      UUID[]          DEFAULT '{}',
  created_at   TIMESTAMPTZ     DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- CONVERSAS DIRETAS (1:1)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE conversas_diretas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_a UUID        NOT NULL REFERENCES perfis(id),
  participante_b UUID        NOT NULL REFERENCES perfis(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participante_a, participante_b)
);

-- ──────────────────────────────────────────────────────────────
-- MENSAGENS (grupos e conversas diretas)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE mensagens (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id    UUID          REFERENCES grupos(id) ON DELETE CASCADE,
  conversa_id UUID          REFERENCES conversas_diretas(id) ON DELETE CASCADE,
  autor_id    UUID          REFERENCES perfis(id),
  autor_nome  TEXT          NOT NULL,
  conteudo    TEXT          NOT NULL,
  tipo        tipo_mensagem DEFAULT 'texto',
  media_url   TEXT,
  criado_em   TIMESTAMPTZ   DEFAULT NOW(),
  editado_em  TIMESTAMPTZ,
  lida        BOOLEAN       DEFAULT FALSE,
  reacoes     JSONB         DEFAULT '[]',
  resposta_a  JSONB,        -- { id, autorNome, conteudo }
  CONSTRAINT chk_destino CHECK (
    (grupo_id IS NOT NULL AND conversa_id IS NULL) OR
    (grupo_id IS NULL AND conversa_id IS NOT NULL)
  )
);

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) — proteção básica
-- ──────────────────────────────────────────────────────────────
ALTER TABLE perfis             ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_itens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_musicas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE musicas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mural_mensagens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_galeria      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE canais_ministerio  ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros_ministerio ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas_diretas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE locais             ENABLE ROW LEVEL SECURITY;
ALTER TABLE aviso_fixado       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_galeria      ENABLE ROW LEVEL SECURITY;

-- Perfil: usuário vê/edita apenas o próprio perfil (admins veem todos via service role)
CREATE POLICY "perfil_select" ON perfis FOR SELECT USING (auth.uid() = id);
CREATE POLICY "perfil_update" ON perfis FOR UPDATE USING (auth.uid() = id);

-- Eventos públicos visíveis para todos sem login
CREATE POLICY "eventos_publicos" ON eventos FOR SELECT USING (publico = TRUE OR auth.uid() IS NOT NULL);
CREATE POLICY "eventos_insert"   ON eventos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "eventos_update"   ON eventos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "eventos_delete"   ON eventos FOR DELETE USING (auth.uid() IS NOT NULL);

-- Notificações: cada usuário vê apenas as suas
CREATE POLICY "notificacoes_own" ON notificacoes FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "notificacoes_update" ON notificacoes FOR UPDATE USING (usuario_id = auth.uid());

-- Mensagens: apenas membros autenticados
CREATE POLICY "mensagens_select" ON mensagens FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mensagens_insert" ON mensagens FOR INSERT WITH CHECK (autor_id = auth.uid());

-- Fotos galeria: leitura pública
CREATE POLICY "galeria_select" ON fotos_galeria FOR SELECT USING (TRUE);

-- Canais: leitura pública para membros autenticados
CREATE POLICY "canais_select" ON canais_ministerio FOR SELECT USING (auth.uid() IS NOT NULL);

-- ──────────────────────────────────────────────────────────────
-- POLÍTICAS ADICIONAIS (necessárias para o app funcionar)
-- ──────────────────────────────────────────────────────────────

-- Perfis: todos os membros autenticados veem todos os perfis (app interno)
DROP POLICY IF EXISTS "perfil_select" ON perfis;
CREATE POLICY "perfil_select" ON perfis FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "perfil_insert" ON perfis FOR INSERT WITH CHECK (auth.uid() = id);

-- Avisos: leitura para membros autenticados
CREATE POLICY "avisos_select" ON avisos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "avisos_insert" ON avisos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "avisos_update" ON avisos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "avisos_delete" ON avisos FOR DELETE USING (auth.uid() IS NOT NULL);

-- Mural mensagens: leitura + envio para autenticados
CREATE POLICY "mural_select" ON mural_mensagens FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mural_insert" ON mural_mensagens FOR INSERT WITH CHECK (autor_id = auth.uid());
CREATE POLICY "mural_update" ON mural_mensagens FOR UPDATE USING (autor_id = auth.uid());
CREATE POLICY "mural_delete" ON mural_mensagens FOR DELETE USING (autor_id = auth.uid());

-- Escalas: leitura + CRUD para autenticados (permissão de criar_escala é checada no app)
CREATE POLICY "escalas_select"        ON escalas       FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "escalas_insert"        ON escalas       FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "escalas_update"        ON escalas       FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "escalas_delete"        ON escalas       FOR DELETE USING (auth.uid() IS NOT NULL);
CREATE POLICY "escala_itens_select"   ON escala_itens  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "escala_itens_insert"   ON escala_itens  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "escala_itens_delete"   ON escala_itens  FOR DELETE USING (auth.uid() IS NOT NULL);
CREATE POLICY "escala_musicas_select" ON escala_musicas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "escala_musicas_insert" ON escala_musicas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "escala_musicas_delete" ON escala_musicas FOR DELETE USING (auth.uid() IS NOT NULL);

-- Músicas: leitura + CRUD para autenticados
CREATE POLICY "musicas_select" ON musicas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "musicas_insert" ON musicas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "musicas_update" ON musicas FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "musicas_delete" ON musicas FOR DELETE USING (auth.uid() IS NOT NULL);

-- ──────────────────────────────────────────────────────────────
-- BUSCA CACHE (resultados de busca no Cifra Club por 30 dias)
-- Gerenciado server-side (service role), sem acesso de clientes
-- ──────────────────────────────────────────────────────────────
CREATE TABLE busca_cache (
  query      TEXT PRIMARY KEY,
  results    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE busca_cache ENABLE ROW LEVEL SECURITY;
-- Somente o service role acessa (sem policies públicas)

-- Locais: leitura + CRUD para autenticados
CREATE POLICY "locais_select" ON locais FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "locais_insert" ON locais FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "locais_update" ON locais FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "locais_delete" ON locais FOR DELETE USING (auth.uid() IS NOT NULL);

-- Aviso fixado: leitura pública, escrita para autenticados
CREATE POLICY "aviso_fixado_select" ON aviso_fixado FOR SELECT USING (TRUE);
CREATE POLICY "aviso_fixado_upsert" ON aviso_fixado FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "aviso_fixado_update" ON aviso_fixado FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Canais ministerio: escrita para autenticados (admin check no app)
CREATE POLICY "canais_insert" ON canais_ministerio FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "canais_update" ON canais_ministerio FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "canais_delete" ON canais_ministerio FOR DELETE USING (auth.uid() IS NOT NULL);

-- Notificações: inserir para autenticados
CREATE POLICY "notificacoes_insert" ON notificacoes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Membros ministerio: CRUD para autenticados
CREATE POLICY "membros_min_select" ON membros_ministerio FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "membros_min_insert" ON membros_ministerio FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "membros_min_update" ON membros_ministerio FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "membros_min_delete" ON membros_ministerio FOR DELETE USING (auth.uid() IS NOT NULL);
