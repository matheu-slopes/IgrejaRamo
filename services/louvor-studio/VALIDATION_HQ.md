# Validação do áudio HQ — 18/09/2026

Implementação local, sem commit/deploy. A migração não foi aplicada ao Supabase remoto. O teste de banco usou PostgreSQL isolado (PGlite), e o teste do worker usou um servidor HTTP local. A integração final autenticada com Supabase e a avaliação auditiva pelo usuário ainda precisam ser realizadas após a ativação.

## Resultados executados

| Verificação | Resultado |
| --- | --- |
| APIs, pesquisa, permissões e tonalidades | 24 testes Node passaram, incluindo 864 combinações de 12 notas × maior/menor × 3 direções |
| Áudio, análise, progresso e worker real | 19 testes Python passaram |
| TypeScript, ESLint e git diff --check | Passaram sem erros ou avisos nos arquivos verificados |
| SQL real isolado | Migração idempotente; fila ignora legados; reserva com token; reserva vencida; cache único; limites; permissões; exclusão em cascata passaram |
| Download real yt-dlp | WebM nativo de 8.517.256 bytes; conversão WAV com 2 canais; duração 504,57 s; download + conversão 4,51 s |
| BS-RoFormer real, trecho de música de 12 s | Voz + instrumental, 2 canais, 44.100 Hz, 529.200 amostras em ambos; 130,00 s de processamento |
| Demucs htdemucs_ft real, mesmo trecho de 12 s | Voz/bateria/baixo/outros com 2 canais, 44.100 Hz e 529.200 amostras; 33,71 s |
| R3 em senoides estéreo distintas | Seis intervalos com altura medida dentro de 2 Hz do esperado; canais permanecem distintos; duração exata |
| Bateria em velocidade 1× | Cópia binariamente idêntica nos seis intervalos |
| Velocidades 0,75× / 0,9× / 1,1× | Duração esperada e altura da bateria preservada |
| Worker/task real com HTTP local | Dois modos, download das entradas, R3, mix FFmpeg, MP3/WAV e uploads; repetição usa cache e gera mix idêntico |
| Prévia instantânea no navegador | Signalsmith Stretch 1.3.2 WASM/AudioWorklet: três cliques consecutivos de `+` atualizaram a interface em 103 ms, sem requisição ao backend nem interrupção da reprodução; renderização offline de senoide 440 Hz em `+3` mediu 526 Hz, 2 canais e pico 0,334 |

O download testado usou José Wellington, “O Amor de Muitos Se Esfriou”, YouTube XahkoqAe2gE. A separação dos dois modelos usou o trecho 80–92 s desse download nativo. Os tempos são medições de trechos em CPU, incluem inicialização e não são previsão exata para uma música inteira. BS-RoFormer/htdemucs_ft priorizam qualidade e continuam pesados sem GPU.

## Vozes solicitadas

R3 `-3 --centre-focus --tempo 1 --frequency <razão> --formant` real, seis intervalos: **−3, −2, −1, +1, +2, +3**.

| Voz / material | Versões | Duração e canais | Tempo por versão, incluindo exportação |
| --- | --- | --- | --- |
| Masculina — José Wellington | 6/6 | 12 s, estéreo 44,1 kHz, diferença de duração de 0 amostras | 1,30–1,56 s |
| Feminina — Laura Souguellis | 6/6 | 12 s, estéreo 44,1 kHz, diferença de duração de 0 amostras | 1,24–1,57 s |
| Coral — Training Choirs | 6/6 | 12 s, estéreo 44,1 kHz, diferença de duração de 0 amostras | 1,34–1,61 s |

Nenhuma versão apresentou amostras não finitas; os canais permaneceram diferentes. Testes de senoides medem a altura; os testes de voz verificam propriedades técnicas e geram arquivos para escuta. Eles **não comprovam perceptualmente** ausência de artefatos nem equivalência ao Moises. Não foi realizada escuta humana pelo agente.

Masculina e feminina foram extraídas dos stems MP3 legados já preparados no projeto, trecho 80–92 s. Essas amostras incluem a compressão/separação antiga, que o R3 não desfaz. O coral usa trecho 4–16 s de [Training Choirs — The Silence and the Song](https://commons.wikimedia.org/wiki/File:Training_Choirs_-_%22The_Silence_and_the_Song%22_(May_2012).ogg), autor Childrenschorussa, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Os derivados de coral mantêm essa licença e indicam recorte/transposição.

Os resultados numéricos estão em `validation/voices.json` e `validation/models.json`. A página local `.cache/hq-validation/listening/comparison.html` permite ouvir originais e todas as variantes. Os áudios não são versionados.

## Arquivos da implementação HQ

- `components/dashboard/LouvorStudioTab.tsx`: escolha dos dois modos e integração do player.
- `components/dashboard/LouvorStudioPlayer.tsx`: reprodução sincronizada, prévia instantânea de tom, correção manual, velocidade, mix/solo, metrônomo, loop e downloads.
- `lib/louvorStudioRealtime.ts` e `public/audio/signalsmith-stretch-1.3.2.js`: prévia local com WASM/AudioWorklet. O componente mantém o Rubber Band R3 para a exportação final.
- `lib/louvorStudioMusic.ts`: cálculo das tonalidades/semitons e lista dos stems.
- `lib/louvorStudioHqServer.ts`: URLs assinadas privadas.
- `app/api/louvor-studio/projects/route.ts`: novas preparações HQ e compatibilidade dos projetos existentes.
- `app/api/louvor-studio/projects/[id]/versions/route.ts`: criação, consulta e cache de transposições.
- `app/api/louvor-studio/worker/hq/route.ts`: reserva, heartbeat, upload e conclusão com token por tentativa.
- `app/api/louvor-studio/worker/jobs/route.ts`: fila antiga limitada a projetos legados.
- `lib/louvorStudioServer.ts`: limpeza de arquivos e versões expiradas.
- `supabase/migrations/20260918_louvor_studio_hq.sql`: schema e função de fila atômica.
- `services/louvor-studio/audio_hq.py`: Stereo WAV, Audio Separator, R3, mix/export e cache.
- `services/louvor-studio/hq_task.py`: download yt-dlp, análise e tarefas de separação/transposição.
- `services/louvor-studio/hq_worker.py`: execução assíncrona, progresso, envio e limpeza.
- `services/louvor-studio/{requirements.txt,Dockerfile,instalar_windows.ps1,iniciar_worker.bat,.env.worker.example,README.md}`: instalação e ativação.
- `.gitignore`: pesos, executáveis e cache local fora do Git.
- `scripts/louvor-studio-hq.test.js`, `scripts/louvor-studio-hq-migration.test.cjs`, `scripts/louvor-studio-search.test.js`: testes de API, música, SQL e regressão.
- `services/louvor-studio/{test_audio_hq.py,test_hq_pipeline.py,validate_voices.py}`: testes com R3 real, pipeline HTTP local e comparações auditivas.

As alterações anteriores de pesquisa/analise (`youtubeSearch.ts`, `withDeadline.ts`, `analysis.py`, `separate.py`, `separation_progress.py`, testes legados e demais arquivos já modificados) foram preservadas. O único `-ac 1` do processamento continua na cópia temporária usada para detectar tom/BPM, sem alterar os WAVs estéreo do fluxo HQ.
