# Louvor Studio — processador local

O site/PWA cria tarefas no Supabase. Este programa consulta a fila pela internet,
processa uma música por vez no computador e envia somente as quatro faixas MP3.
Ele não abre portas e não recebe a chave SUPABASE_SERVICE_ROLE_KEY.

## Instalação no Windows

1. Instale Python 3.11 (64 bits). Python 3.13 não é recomendado para PyTorch/Demucs.
2. No PowerShell desta pasta, execute:
   powershell -ExecutionPolicy Bypass -File .\instalar_windows.ps1
3. Abra .env.worker e preencha:
   - LOUVOR_STUDIO_SITE_URL: endereço de produção do site.
   - LOUVOR_STUDIO_WORKER_SECRET: o mesmo segredo salvo na Vercel.
4. Execute iniciar_worker.bat e deixe a janela aberta durante o processamento.

## Configuração do site

1. Execute a migration supabase/migrations/20260917_louvor_studio_local_worker.sql.
2. Na Vercel, crie LOUVOR_STUDIO_WORKER_SECRET com o mesmo valor de .env.worker.
3. Para pesquisar pelo nome, crie uma chave gratuita da YouTube Data API v3 e
   salve-a na Vercel como YOUTUBE_API_KEY. Sem ela, colar a URL do vídeo continua
   funcionando.
4. Faça um novo deploy da Vercel.

Não configure SUPABASE_SERVICE_ROLE_KEY neste processador local. A chave
administrativa continua somente no servidor da Vercel.

O FFmpeg é fornecido isoladamente por imageio-ffmpeg; não é necessária uma
instalação global. Arquivos temporários são apagados ao final de cada tarefa.

Use somente áudio próprio, licenciado ou autorizado pelos titulares. Uma área
privada não altera os direitos autorais da obra nem os termos da plataforma fonte.
