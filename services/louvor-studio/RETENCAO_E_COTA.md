# Retenção por culto e proteção de espaço

## Ativação

1. No SQL Editor do projeto Supabase, aplicar nesta ordem:
   - `supabase/migrations/20261005_louvor_studio_retencao_por_culto.sql`
   - `supabase/migrations/20261006_louvor_studio_cota_r2.sql`
2. Aguardar o worker terminar qualquer tarefa e interrompê-lo antes da publicação.
3. Publicar a API e a interface atualizadas. A nova API exige o manifesto de tamanhos enviado pelo novo worker.
4. Atualizar `hq_worker.py` na instalação que realmente executa o processamento e reiniciar o worker. Não alterar o segredo existente.
5. Conferir uma preparação curta, a reprodução existente e uma exportação. Não usar áudio de produção para testar exclusões; os testes locais cobrem a retenção.

As migrações não apagam músicas nem arquivos. A primeira ajusta a expiração das preparações já vinculadas a cultos; ao ativar a limpeza, os áudios dos cultos passados passam a ser elegíveis para remoção.

Sem as migrações, a proteção falha de forma conservadora: novas preparações não são autorizadas. Por isso, não publicar a API antes de aplicar o SQL.

## Comportamento

- Letras e cifras permanecem no Repertório. Tom e BPM salvos na escala também permanecem.
- O áudio vinculado a cultos vence à meia-noite de Brasília após o último culto vinculado. Se o mesmo áudio estiver em outra escala futura, permanece até essa data.
- A remoção ocorre na rotina diária já existente às 08h de Brasília e também ao consultar a biblioteca, em lotes de até 20 preparações. Não é um agendamento exato de exclusão à meia-noite.
- Ensaios sem vínculo com culto mantêm sua retenção anterior: pessoal de 7 dias, livre da equipe de 90 dias.
- A limpeza remove MP3, FLAC e exportações preparados dentro do prefixo do projeto. Exclui somente a preparação Studio e suas versões; o vínculo Studio da escala fica nulo.
- Uma reserva atômica de limpeza impede reutilizar arquivos enquanto sua exclusão está em andamento. Uma execução interrompida pode ser retomada após 15 minutos.
- Transpose ao vivo e salvar o tom na escala não criam novos arquivos. Preparar download em outro tom cria uma exportação e passa pela proteção de espaço.

## Cota

O teto interno é de **8.000.000.000 bytes**, medidos em todos os objetos do bucket R2 configurado, incluindo arquivos parciais. Não é o limite comercial do provedor.

Cada nova preparação/exportação reserva inicialmente até 1,1 GB, considerando o pior caso permitido pelo worker. Antes do envio, a reserva é ajustada ao tamanho real dos arquivos. Reservas concorrentes são somadas no banco; uma medição antiga também contabiliza uploads recém-finalizados. Reservas abandonadas vencem em 8 horas; qualquer novo upload precisa ser autorizado novamente.

Ao faltar espaço, novas preparações são recusadas com mensagem explicativa. A reprodução e os downloads de arquivos já prontos não dependem dessa autorização. Nenhuma qualidade ou formato existente foi alterado nesta atualização.

Essa proteção não controla gravações manuais ou outros programas que usem o mesmo bucket. Também não limita contadores de operações do R2, outros buckets da conta ou saída do Supabase usada pelo restante do site; não é uma garantia de custo zero de toda a aplicação.

## Testes locais

```powershell
node --test --test-isolation=none scripts/louvor-studio-quota.test.cjs scripts/louvor-studio-retention.test.cjs scripts/louvor-studio-hq.test.js scripts/louvor-studio-delete.test.js
node node_modules/typescript/bin/tsc --noEmit
npm install --prefix .cache/studio-retention-test --no-save --no-package-lock @electric-sql/pglite
node scripts/louvor-studio-retention-migration.test.cjs
```

O último teste aplica as migrações duas vezes em um PostgreSQL local descartável. Valida preservação do Repertório e dos tons, vínculos em várias escalas, reagendamento, disputa com limpeza e reservas de espaço simultâneas. Não acessa produção.
