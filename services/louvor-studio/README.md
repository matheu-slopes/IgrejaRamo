# Louvor Studio Worker

Serviço privado para baixar áudio autorizado do YouTube, detectar tom/BPM e separar
`vocals`, `drums`, `bass` e `other`. Ele precisa rodar fora da Vercel porque Demucs e
PyTorch exigem mais memória e tempo do que uma função serverless oferece.

## Variáveis do container

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
LOUVOR_STUDIO_WORKER_SECRET=gere-um-segredo-longo-e-aleatorio
DEMUCS_MODEL=htdemucs
```

Na Vercel, configure o mesmo `LOUVOR_STUDIO_WORKER_SECRET` e também:

```env
LOUVOR_STUDIO_WORKER_URL=https://endereco-do-worker
```

O Dockerfile pode ser publicado no Railway, Render ou em um VPS. Recomenda-se pelo
menos 4 GB de RAM; GPU é opcional, mas reduz bastante o tempo de separação.

Use somente áudio próprio, em domínio público ou para o qual a igreja possua licença
ou autorização. O fato de a área ser privada não altera os direitos autorais da obra.

