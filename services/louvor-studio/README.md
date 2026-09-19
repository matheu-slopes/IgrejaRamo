# Louvor Studio — processamento local HQ

## Ativação

1. Aplique as migrações existentes de Louvor Studio e depois `supabase/migrations/20260918_louvor_studio_hq.sql` no SQL Editor do Supabase. A migração é aditiva: preserva projetos e MP3 existentes.
2. Atualize as dependências com `powershell -ExecutionPolicy Bypass -File .\instalar_windows.ps1`. O instalador prepara Python 3.11, Audio Separator e Rubber Band 4.0.0 (R3). Os pesos são baixados no primeiro uso e reutilizados em `.models`.
3. Configure `.env.worker`: `LOUVOR_STUDIO_SITE_URL` deve apontar para a API atualizada. Para testar os arquivos locais, use `iniciar_worker.bat local` (sobrescreve a URL somente nessa execução), ou configure `http://localhost:3000`. Mantenha o mesmo `LOUVOR_STUDIO_WORKER_SECRET` do servidor. Nunca coloque a service role do Supabase no worker.
4. Feche o worker antigo após sua tarefa terminar e execute `iniciar_worker.bat`. O novo launcher usa `hq_worker.py`. Reinicie após alterar código Python.
5. Para produção, publique também as novas rotas e a alteração da fila legada antes de iniciar novas tarefas. Um worker antigo consultando uma API antiga pode capturar tarefas novas se compartilhar o mesmo banco; não mantenha esse processo ativo durante o teste local.

O download do YouTube continua usando yt-dlp `bestaudio/best`. Pesquisa por nome continua sem baixar áudio e sem precisar do PC ligado. A preparação baixa o arquivo nativo e converte uma vez para WAV estéreo float32 a 44,1 kHz. As exportações finais oferecem MP3 320 kbps e FLAC estéreo 16-bit em qualidade de CD; o FLAC reduz o tamanho para caber no limite por arquivo do Storage. A análise de tom/BPM usa uma cópia mono curta e não altera os canais do áudio de processamento.

## Separação e transposição

- Padrão: `audio-separator==0.47.0`, BS-RoFormer `model_bs_roformer_ep_317_sdr_12.9755.ckpt`: voz e instrumental.
- Avançado: mesmo pacote, `htdemucs_ft.yaml`: voz, bateria, baixo e outros. Os quatro modelos fine-tuned são mais lentos, especialmente em CPU.
- Em CPU, o worker usa 8 threads por padrão. Ajuste `LOUVOR_STUDIO_CPU_THREADS` em `.env.worker` para `12` no i5-13500 quando quiser priorizar velocidade; use `4` se precisar manter o PC mais responsivo. Reinicie o worker depois de alterar esse valor.
- Transposição para download: executável Rubber Band com `-3 --centre-focus --tempo 1 --frequency <razão>`. Na voz, também `--formant`. Não há filtro de pitch do FFmpeg nem Tone.PitchShift no resultado final.
- No avançado, voz/baixo/outros recebem o mesmo intervalo; bateria a 1× é copiada sem modificar nenhuma amostra. Ao alterar velocidade, todas as faixas mudam de duração igualmente; a altura da bateria fica preservada.
- FFmpeg faz conversão, soma das faixas e exportação. WAV float32 estéreo é usado nos intermediários. Uma validação rejeita canais/taxas incorretos, amostras inválidas e divergências de duração maiores que 2048 amostras; pequenas diferenças finais são alinhadas.
- O player usa Web Audio com o mesmo instante de início para todas as faixas. Os botões `−/+` fazem prévia imediata usando Signalsmith Stretch (WASM/AudioWorklet), em estéreo; voz usa compensação de formantes e bateria permanece sem mudança de altura. Essa prévia não baixa nem cria uma tarefa no PC local. Navegadores sem AudioWorklet continuam reproduzindo o original e mostram a indisponibilidade da prévia.
- Em **Mais opções**, `Preparar download neste tom` mantém a versão Rubber Band R3 no servidor local para MP3/FLAC. A correção manual do tom original também fica ali. Maior/menor é preservado; trocar de modo exige reharmonização e é rejeitado pela API.
- Projetos antigos continuam tocando e aceitam versões R3 usando seus stems MP3 existentes. A compressão antiga não pode ser desfeita: prepare novamente para obter stems novos sem perdas.

## Fila, cache e arquivos

A função SQL `claim_louvor_hq` faz reserva atômica com token por tentativa. O worker publica progresso/heartbeat a cada cinco segundos. Reservas sem heartbeat por cinco minutos viram erro visível; versões admitem até três tentativas. Há limites de tarefas pendentes por usuário e um bloqueio de instância local do worker. Na etapa final, até três arquivos são enviados em paralelo para reduzir a espera de upload dos stems WAV/MP3.

O cache local usa hash do áudio, modelo/versão do processamento, semitons e velocidade; não usa apenas o título. Escritas são finalizadas atomicamente e entradas sem uso por sete dias são apagadas. Os temporários de cada tarefa são removidos ao terminar ou falhar. Limite total de uma tarefa: `HQ_TIMEOUT_SECONDS`, padrão 7200 segundos. No encerramento por timeout, os processos filhos também são finalizados.

O banco reutiliza uma única versão por projeto/semitons/velocidade/engine. O bucket privado guarda stems base WAV/MP3 e versões MP3 mais mix WAV/MP3. URLs são assinadas e a expiração da escala remove também as versões. Downloads de faixas e mix ficam no player; controles de volume/solo afetam somente a escuta, não o mix exportado.

WAV float32 estéreo pode ocupar cerca de 424 MB em uma gravação de 20 minutos. A migração configura o bucket para 512 MiB por arquivo; o limite global do plano Supabase também precisa comportar esse tamanho. O cache e os pesos requerem espaço em disco. CPU processa os dois modelos, mas alta qualidade não implica separação mais rápida.

Docker instala `rubberband-cli` e usa o mesmo worker; preserve `/app/.models` e `/app/.audio-cache` em volumes. `app.py`, `separate.py` e `separation_progress.py` permanecem para tarefas legadas (`pipeline_version=1`); não são o caminho de novas preparações HQ.

## Validação

Na raiz do repositório:

```powershell
node --test scripts/louvor-studio-search.test.js scripts/louvor-studio-hq.test.js
services/louvor-studio/.venv/Scripts/python.exe -m unittest discover -s services/louvor-studio -p test_*.py -v
npm install --prefix .cache/hq-test-deps --no-package-lock @electric-sql/pglite
node scripts/louvor-studio-hq-migration.test.cjs
```

O teste Python de integração executa o worker/task real com HTTP local para entrada/envio e R3/FFmpeg reais, em ambos os modos, incluindo repetição por cache. Não grava nada em produção. Os testes de separação com pesos reais precisam de modelos e podem demorar. `validate_voices.py --fixtures DIR --output DIR` gera as 18 variantes usando `male.wav`, `female.wav` e `choir.wav` estéreo autorizados, além de uma página para comparação auditiva. Consulte `VALIDATION_HQ.md` para resultados e limites da validação realizada.

Fontes: [Rubber Band](https://www.breakfastquay.com/rubberband/), [Audio Separator](https://github.com/nomadkaraoke/python-audio-separator). O binário Rubber Band distribuído pelo instalador é GPL; preserve os arquivos de licença. Use somente áudio próprio, licenciado ou autorizado.
