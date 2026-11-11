-- Preserve shared records when their author or participant account is deleted.
-- Direct conversations belong to their participants and are removed with them.
DO $$
DECLARE
  item record;
  fk record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('eventos', 'criado_por', 'SET NULL'),
      ('escalas', 'criado_por', 'SET NULL'),
      ('escala_itens', 'voluntario_id', 'SET NULL'),
      ('mural_mensagens', 'autor_id', 'SET NULL'),
      ('devocionais', 'criado_por', 'SET NULL'),
      ('grupos', 'admin_id', 'SET NULL'),
      ('mensagens', 'autor_id', 'SET NULL'),
      ('conversas_diretas', 'participante_a', 'CASCADE'),
      ('conversas_diretas', 'participante_b', 'CASCADE'),
      ('louvor_studio_versions', 'criado_por', 'SET NULL')
    ) AS changes(table_name, column_name, delete_action)
  LOOP
    FOR fk IN
      SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND n.nspname = 'public'
        AND t.relname = item.table_name AND a.attname = item.column_name
        AND array_length(c.conkey, 1) = 1
        AND c.confrelid IN ('public.perfis'::regclass, 'auth.users'::regclass)
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', item.table_name, fk.conname);
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s ON DELETE %s',
        item.table_name, fk.conname,
        regexp_replace(fk.definition, ' ON DELETE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)', '', 'i'),
        item.delete_action);
    END LOOP;
  END LOOP;
END $$;
