const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const projectId = 'a007fe56-8080-4924-b79d-b7fd429edddb';
function loadRoute(mocks) {
  const filename = path.resolve(__dirname, '..', 'app/api/louvor-studio/projects/[id]/route.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : originalRequire(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}
function route({ manager = true, status = 'concluido' } = {}) {
  const removed = []; let deleted = false;
  const db = {
    from() {
      return {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: { id: projectId, status }, error: null }; },
        delete() { deleted = true; return this; },
      };
    },
    storage: { from() { return {
      async list() { return { data: [{ name: 'vocals.mp3' }, { name: 'mix.wav' }], error: null }; },
      async remove(paths) { removed.push(...paths); return { error: null }; },
    }; } },
  };
  const { DELETE } = loadRoute({
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/louvorStudioServer': {
      getLouvorStudioUser: async () => ({ id: 'leader' }),
      getLouvorStudioAccess: async () => ({ podeGerenciar: manager }),
      louvorStudioAdmin: db,
    },
  });
  return {
    call: (id = projectId) => DELETE(new Request('http://localhost/project', { method: 'DELETE' }), { params: Promise.resolve({ id }) }),
    removed: () => removed, deleted: () => deleted,
  };
}

test('deleting a completed song removes its storage files and database row', async () => {
  const subject = route();
  assert.equal((await subject.call()).status, 200);
  assert.deepEqual(subject.removed(), [`${projectId}/vocals.mp3`, `${projectId}/mix.wav`]);
  assert.equal(subject.deleted(), true);
});
test('deletion rejects non-managers, invalid ids and songs still processing', async () => {
  assert.equal((await route({ manager: false }).call()).status, 403);
  assert.equal((await route().call('invalid')).status, 400);
  assert.equal((await route({ status: 'separando' }).call()).status, 409);
});
