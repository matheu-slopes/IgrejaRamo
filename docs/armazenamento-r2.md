# Auditoria e migração de arquivos

O Louvor Studio usa o bucket R2 configurado por `CLOUDFLARE_R2_BUCKET` para novos arquivos. Sua reserva de espaço considera o bucket inteiro; não coloque arquivos de outros módulos nesse bucket sem rever a cota e as limpezas existentes.

As fotos de perfil ainda podem estar no banco. As imagens e os demais anexos do chat usam os buckets `chat-imagens` e `chat-midias` do Supabase. A migração para um bucket R2 separado ainda não está implementada. A URL atual dos anexos não deve ser simplesmente substituída por um link público: é necessário validar o acesso ao ministério ou à conversa e usar acesso privado com validade limitada.

## Auditoria somente de leitura

Com Node.js compatível com `--env-file` e as dependências instaladas:

```powershell
node --env-file=.env.local scripts/auditar-armazenamento.cjs
```

O comando consulta os três buckets existentes no Supabase, o bucket R2 do Studio e os caminhos registrados nas tabelas de projetos e versões. Ele apresenta somente quantidades e tamanhos; não mostra nomes, URLs, conteúdo dos arquivos ou credenciais. A chave de serviço e a credencial R2 continuam somente no ambiente do servidor. Confira que `.env.local` aponta ao projeto pretendido antes de executar.

Os resultados são um retrato durante a execução, e listas paginadas podem mudar enquanto há gravações. Referências armazenadas em outras tabelas, códigos antigos ou fontes externas não são auditadas. Um arquivo não encontrado nas tabelas consultadas não está automaticamente autorizado para exclusão.

## Antes de migrar

1. Criar um bucket privado R2 separado para as mídias gerais e uma credencial limitada a esse bucket; manter os dados de acesso fora do Git e do chat.
2. Desenvolver upload e leitura autorizados, limites por tipo e tamanho, controle de uso concorrente e proteção contra arquivos órfãos. Preservar a compatibilidade com URLs antigas até a migração e a validação terminarem.
3. Copiar arquivos sem apagar as origens, conferir tamanho e integridade e atualizar referências de forma reversível. Planejar o consumo de saída do Supabase gerado pela cópia e verificar a cota antes de executá-la.
4. Testar com contas e arquivos de teste, inclusive acessos não autorizados, antes de habilitar em produção. Apenas depois de verificar referências e recuperação decidir sobre qualquer limpeza.

A franquia mensal de saída do Supabase pertence à organização e abrange vários serviços. A auditoria de armazenamento não mede a saída nem substitui monitoramento oficial de uso.
