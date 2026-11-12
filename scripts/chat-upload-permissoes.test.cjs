const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function criarTeste({ membro = false, lider = false, bloqueado = false, erroCanal = false, erroAcesso = false, membroConversa = false } = {}) {
  const calls = [];
  const admin = { from(tabela) { assert.equal(tabela, "canais_ministerio"); return { select() { return { eq(coluna, valor) { calls.push([coluna, valor]); return { async maybeSingle() { return erroCanal ? { data: null, error: {} } : { data: { chat_bloqueado: bloqueado }, error: null }; } }; } }; } }; } };
  const source = fs.readFileSync("lib/chatUploadAuth.ts", "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modulo = { exports: {} };
  const imports = (nome) => {
    if (nome === "@/lib/chatServerAuth") return { isChatMember: async () => membroConversa };
    if (nome === "@/lib/ministerioAcesso") return { acessoMinisterio: async (_admin, _user, ministerio) => { calls.push(["acesso", ministerio]); if (erroAcesso) throw new Error("indisponível"); return { membro, lider }; } };
    return require(nome);
  };
  new Function("exports", "module", "require", js)(modulo.exports, modulo, imports);
  return { executar: (destino) => modulo.exports.autorizarUploadChat(admin, destino, "usuario"), calls };
}

test("autoriza membro em ministério aberto e usa caminho seguro", async () => {
  const t = criarTeste({ membro: true });
  const result = await t.executar("ministerio_Ação Social");
  assert.equal(result.ok, true);
  assert.match(result.caminho, /^ministerios\/[a-f0-9]{64}$/);
  assert.deepEqual(t.calls[0], ["acesso", "Ação Social"]);
});

test("bloqueia não membros e falhas na verificação", async () => {
  assert.equal((await criarTeste().executar("ministerio_Louvor")).status, 403);
  assert.equal((await criarTeste({ erroAcesso: true }).executar("ministerio_Louvor")).status, 503);
  assert.equal((await criarTeste({ membro: true, erroCanal: true }).executar("ministerio_Louvor")).status, 503);
});

test("respeita chat fechado para membros e libera liderança", async () => {
  assert.equal((await criarTeste({ membro: true, bloqueado: true }).executar("ministerio_Louvor")).status, 403);
  assert.equal((await criarTeste({ membro: true, lider: true, bloqueado: true }).executar("ministerio_Louvor")).ok, true);
});

test("mantém autorização nas conversas comuns e recusa identificadores inválidos", async () => {
  const id = "12345678-1234-1234-1234-123456789abc";
  assert.equal((await criarTeste({ membroConversa: true }).executar(id)).caminho, id);
  assert.equal((await criarTeste().executar(id)).status, 403);
  assert.equal((await criarTeste({ membroConversa: true }).executar("../outra-conversa")).status, 400);
});

async function executarRota(caminho, arquivo, tipo, permitido) {
  const uploads = [];
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) },
    storage: { from: (bucket) => ({
      upload: async (nome, dados, options) => { uploads.push({ bucket, nome, tamanho: dados.byteLength, tipo: options.contentType }); return { error: null }; },
      getPublicUrl: (nome) => ({ data: { publicUrl: `https://storage.example/${nome}` } }),
    }) },
  };
  const source = fs.readFileSync(caminho, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modulo = { exports: {} };
  const imports = (nome) => {
    if (nome === "@supabase/supabase-js") return { createClient: () => admin };
    if (nome === "next/server") return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
    if (nome === "@/lib/chatUploadAuth") return { autorizarUploadChat: async (_admin, destino) => { assert.equal(destino, "ministerio_Louvor"); return permitido ? { ok: true, caminho: "ministerios/seguro" } : { ok: false, status: 403, erro: "Acesso negado" }; } };
    return require(nome);
  };
  new Function("exports", "module", "require", js)(modulo.exports, modulo, imports);
  const form = new FormData();
  form.set("file", arquivo);
  form.set("conversa_id", "ministerio_Louvor");
  if (tipo) form.set("file_type", tipo);
  const resposta = await modulo.exports.POST({ headers: new Headers({ authorization: "Bearer teste" }), formData: async () => form });
  return { resposta, uploads };
}

test("as rotas de áudio e imagem usam o destino autorizado", async () => {
  const audio = await executarRota("app/api/chat/upload-arquivo/route.ts", new File(["audio"], "audio.m4a", { type: "audio/mp4" }), "audio", true);
  assert.equal(audio.resposta.status, 200);
  assert.equal(audio.uploads[0].bucket, "chat-midias");
  assert.equal(audio.uploads[0].tipo, "audio/mp4");
  assert.match(audio.uploads[0].nome, /^usuario\/ministerios\/seguro\//);
  const imagem = await executarRota("app/api/chat/upload-imagem/route.ts", new File(["imagem"], "imagem.jpg", { type: "image/jpeg" }), undefined, true);
  assert.equal(imagem.resposta.status, 200);
  assert.equal(imagem.uploads[0].bucket, "chat-imagens");
  assert.match(imagem.uploads[0].nome, /^usuario\/ministerios\/seguro\//);
  const negado = await executarRota("app/api/chat/upload-arquivo/route.ts", new File(["audio"], "audio.webm", { type: "audio/webm" }), "audio", false);
  assert.equal(negado.resposta.status, 403);
  assert.equal(negado.uploads.length, 0);
});

test("a API rejeita vídeos mesmo quando enviados diretamente", async () => {
  const video = await executarRota("app/api/chat/upload-arquivo/route.ts", new File(["video"], "video.mp4", { type: "video/mp4" }), "video", true);
  assert.equal(video.resposta.status, 400);
  assert.equal(video.uploads.length, 0);
});
