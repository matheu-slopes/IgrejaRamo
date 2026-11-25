# Auditoria e migração de arquivos

O Louvor Studio usa o bucket R2 configurado por `CLOUDFLARE_R2_BUCKET` para novos arquivos. Sua reserva de espaço considera o bucket inteiro; não coloque arquivos de outros módulos nesse bucket sem rever a cota e as limpezas existentes.

As fotos de perfil ainda podem estar no banco. Imagens e anexos antigos do chat usam os buckets `chat-imagens` e `chat-midias` do Supabase. A integração para novos arquivos em um bucket R2 privado separado está preparada, mas exige configuração, migrações e validação antes da ativação. Arquivos antigos continuam acessíveis pelo caminho anterior; não foram removidos nem migrados automaticamente.

## Auditoria somente de leitura

Com Node.js compatível com `--env-file` e as dependências instaladas:

```powershell
node --env-file=.env.local scripts/auditar-armazenamento.cjs
```

O comando consulta os três buckets existentes no Supabase, o bucket R2 do Studio e os caminhos registrados nas tabelas de projetos e versões. Ele apresenta somente quantidades e tamanhos; não mostra nomes, URLs, conteúdo dos arquivos ou credenciais. A chave de serviço e a credencial R2 continuam somente no ambiente do servidor. Confira que `.env.local` aponta ao projeto pretendido antes de executar.

Os resultados são um retrato durante a execução, e listas paginadas podem mudar enquanto há gravações. Referências armazenadas em outras tabelas, códigos antigos ou fontes externas não são auditadas. Um arquivo não encontrado nas tabelas consultadas não está automaticamente autorizado para exclusão.

## Antes de migrar

1. Configurar no servidor `CLOUDFLARE_R2_MEDIA_BUCKET`, `CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID` e `CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY`, com acesso somente ao bucket privado de mídias gerais. Não incluir segredos no Git nem no navegador.
2. Aplicar no banco correto as migrações `20260615_chat_participante_historico.sql`, `20260616_chat_participante_ocultado.sql` e `20261124_cota_midias_r2.sql`. As duas primeiras são necessárias para proteger o histórico das conversas; a integração recusa acesso se não conseguir conferir essas colunas.
3. Publicar primeiro a versão que lê as novas referências com `NEXT_PUBLIC_MIDIAS_R2_ATIVAS` desligada. Verificar permissões e funcionamento em produção antes de habilitar o envio com essa variável no servidor e no build do cliente.
4. O limite implementado para o bucket de mídias é de 1 GB e 4 MiB por arquivo. Essa reserva não é um limite global de toda a conta Cloudflare e não impede excesso de saída do Supabase; acompanhar os painéis de uso continua necessário. Os arquivos órfãos são contabilizados e requerem uma futura rotina de reconciliação.
5. Depois de validar a leitura publicada, executar `node --env-file=.env.local scripts/migrar-fotos-perfil-r2.cjs` para simular a migração. A execução real exige também `MIGRACAO_FOTOS_LEITOR_PUBLICADO=true` e `--executar`; o script verifica integridade e conserva um backup da referência anterior no banco. Os anexos antigos do chat ainda precisam de migração própria.
6. Não apagar originais sem conferir referências, recuperação e o consumo de saída do Supabase. Testar com contas de diferentes permissões e nos dispositivos de uso real.

A franquia mensal de saída do Supabase pertence à organização e abrange vários serviços. A auditoria de armazenamento não mede a saída nem substitui monitoramento oficial de uso.
