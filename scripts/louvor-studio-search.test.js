const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Run the actual TypeScript modules without adding a test runner dependency.
function loadTs(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
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

const search = loadTs('lib/youtubeSearch.ts');
const { withDeadline } = loadTs('lib/withDeadline.ts');
const video = (id = '5QHF5OQeFOs', length = '9:22') => ({ videoRenderer: {
  videoId: id, title: { runs: [{ text: 'A Casa É Sua' }] },
  ownerText: { runs: [{ text: 'Casa Worship' }] }, lengthText: { simpleText: length },
} });
const html = (items, assignment = 'var ytInitialData') => '<script>' + assignment + ' = ' + JSON.stringify({
  contents: { twoColumnSearchResultsRenderer: { primaryContents: {
    sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: items } }] },
  } } },
}) + ';</script>';

function mockFetch(t, handler) { t.mock.method(globalThis, 'fetch', handler); }

test('recognizes standard, short, live, embed and music links; rejects invalid hosts/IDs', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=5QHF5OQeFOs&list=foo',
    'https://youtu.be/5QHF5OQeFOs?t=20',
    'https://youtube.com/shorts/5QHF5OQeFOs',
    'https://youtube.com/live/5QHF5OQeFOs',
    'https://youtube.com/embed/5QHF5OQeFOs',
    'https://music.youtube.com/watch?v=5QHF5OQeFOs',
  ]) assert.equal(search.youtubeId(url), '5QHF5OQeFOs');
  for (const value of ['nome da musica', 'https://notyoutube.com/watch?v=5QHF5OQeFOs',
    'https://youtube.com/watch?v=bad', 'https://youtube.com/playlist?list=123',
    'ftp://youtube.com/watch?v=5QHF5OQeFOs']) assert.equal(search.youtubeId(value), null);
});

test('extracts selection metadata, deduplicates, excludes ads/playlists, limits to eight', () => {
  const entries = [video(), video(), { adSlotRenderer: { content: video('AAAAAAAAAAA') } },
    { playlistRenderer: { videos: [video('BBBBBBBBBBB')] } }, video('bad')];
  for (let i = 0; i < 12; i++) entries.push(video(String(i).padStart(11, '0'), '1:02:03'));
  const results = search.parseYoutubeSearch(html(entries));
  assert.equal(results.length, 8);
  assert.equal(results[0].titulo, 'A Casa É Sua');
  assert.equal(results[0].artista, 'Casa Worship');
  assert.equal(results[0].duracao, 562);
  assert.equal(results[1].duracao, 3723);
  assert(!results.some((r) => ['AAAAAAAAAAA', 'BBBBBBBBBBB'].includes(r.id)));
  assert.equal(results[0].url, 'https://www.youtube.com/watch?v=5QHF5OQeFOs');
});

test('accepts alternate assignment and distinguishes empty searches from consent/errors', () => {
  assert.equal(search.parseYoutubeSearch(html([video()], 'window["ytInitialData"]')).length, 1);
  assert.deepEqual(search.parseYoutubeSearch(html([])), []);
  assert.equal(search.parseYoutubeSearch(html([video('5QHF5OQeFOs', 'LIVE')]))[0].duracao, undefined);
  assert.throws(() => search.parseYoutubeSearch('<html>Consent required</html>'));
  assert.throws(() => search.parseYoutubeSearch('<script>var ytInitialData = nope;</script>'));
});

test('name search without API key fetches one page, then uses cache', async (t) => {
  let calls = 0;
  mockFetch(t, async (url, options) => {
    calls++;
    assert.equal(new URL(url).hostname, 'www.youtube.com');
    assert.equal(new URL(url).searchParams.get('search_query'), 'louvor sem chave');
    assert(options.signal);
    return new Response(html([video()]));
  });
  assert.equal((await search.searchYoutube('louvor sem chave', new AbortController().signal)).length, 1);
  await search.searchYoutube('LOUVOR SEM CHAVE', new AbortController().signal);
  assert.equal(calls, 1);
});

test('API failure falls back to public search; no audio or duration downloads', async (t) => {
  const calls = [];
  mockFetch(t, async (url) => {
    calls.push(new URL(url).hostname);
    return calls.length === 1 ? new Response('{}', { status: 403 }) : new Response(html([video()]));
  });
  assert.equal((await search.searchYoutube('api unavailable', new AbortController().signal, 'test-key')).length, 1);
  assert.deepEqual(calls, ['www.googleapis.com', 'www.youtube.com']);
});

test('API success returns decoded titles without an extra metadata request', async (t) => {
  let calls = 0;
  mockFetch(t, async () => {
    calls++;
    return Response.json({ items: [{ id: { videoId: '5QHF5OQeFOs' }, snippet: {
      title: 'Música &amp; Louvor', channelTitle: 'Artista',
    } }] });
  });
  const results = await search.searchYoutube('api success', new AbortController().signal, 'test-key');
  assert.equal(results[0].titulo, 'Música & Louvor');
  assert.equal(calls, 1);
});

test('link metadata failure preserves a selectable video', async (t) => {
  mockFetch(t, async () => { throw new Error('network unavailable'); });
  const result = await search.youtubeLinkResult('5QHF5OQeFOs', new AbortController().signal);
  assert.equal(result.id, '5QHF5OQeFOs');
  assert.equal(result.url, 'https://www.youtube.com/watch?v=5QHF5OQeFOs');
  assert(result.thumbnailUrl);
});

test('deadline rejects even if session/network ignores cancellation; signal is aborted', async () => {
  let signal;
  await assert.rejects(withDeadline((current) => {
    signal = current;
    return new Promise(() => {});
  }, 15), { name: 'TimeoutError' });
  assert.equal(signal.aborted, true);
  assert.equal(await withDeadline(async () => 42, 50), 42);
});

test('aborted request does not query YouTube or return cached results', async (t) => {
  mockFetch(t, () => assert.fail('must not fetch'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(search.searchYoutube('louvor sem chave', controller.signal), { name: 'AbortError' });
});

function route(overrides = {}) {
  return loadTs('app/api/louvor-studio/search/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/louvorStudioServer': {
      getLouvorStudioUser: async () => ({ id: 'user' }),
      getLouvorStudioAccess: async () => ({ podeVer: true, podeGerenciar: true }),
      ...overrides,
    },
    '@/lib/youtubeSearch': search,
    '@/lib/withDeadline': { withDeadline: (operation) => withDeadline(operation, 40) },
  }).POST;
}
const request = (query) => new Request('http://localhost/api/louvor-studio/search', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
});

test('route preserves authentication and manager-only access', async (t) => {
  mockFetch(t, () => assert.fail('unauthorized search must not fetch'));
  assert.equal((await route({ getLouvorStudioUser: async () => null })(request('musica'))).status, 401);
  assert.equal((await route({ getLouvorStudioAccess: async () => ({ podeVer: false, podeGerenciar: false }) })(request('musica'))).status, 403);
});

test('route rejects malformed queries and non-YouTube links', async (t) => {
  mockFetch(t, () => assert.fail('invalid query must not fetch'));
  for (const query of [null, 123, {}, '', 'a', 'x'.repeat(501), 'https://notyoutube.com/watch?v=5QHF5OQeFOs']) {
    assert.equal((await route()(request(query))).status, 400);
  }
});

test('route returns selectable results for a name and for a link', async (t) => {
  mockFetch(t, async (url) => String(url).includes('/oembed')
    ? Response.json({ title: 'A Casa É Sua', author_name: 'Casa Worship' })
    : new Response(html([video()])));
  for (const query of ['route song search', 'https://youtu.be/5QHF5OQeFOs']) {
    const response = await route()(request(query));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).resultados[0].id, '5QHF5OQeFOs');
  }
});

test('route returns 504 when authentication stalls instead of waiting forever', async () => {
  const response = await route({ getLouvorStudioUser: () => new Promise(() => {}) })(request('musica'));
  assert.equal(response.status, 504);
});

test('route reports blocked public search as an error instead of no results', async (t) => {
  mockFetch(t, async () => new Response('<html>Blocked</html>'));
  assert.equal((await route()(request('blocked query'))).status, 502);
});

function projectRoute({ authorized = true, manager = true, worker = true, validScale = true } = {}) {
  let inserted;
  const admin = { from(table) {
    if (table === 'escalas') {
      const query = { select() { return this; }, eq() { return this; }, async maybeSingle() {
        return { data: validScale ? { id: 'scale', ministerio: 'Louvor', data: '2026-09-17' } : null };
      } };
      return query;
    }
    assert.equal(table, 'louvor_studio_projetos');
    return { select() { return this; }, eq() { return this; }, gt() { return this; }, order() { return this; }, limit() { return this; },
      async maybeSingle() { return { data: null }; }, async in() { return { count: 0 }; }, insert(value) {
      inserted = value;
      return { select() { return { async single() { return { data: { id: 'project', ...value } }; } }; } };
    } };
  } };
  const { POST } = loadTs('app/api/louvor-studio/projects/route.ts', {
    '@/lib/youtubeSearch': search,
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/louvorStudioServer': {
      getLouvorStudioUser: async () => authorized ? { id: 'user' } : null,
      getLouvorStudioAccess: async () => ({ podeVer: true, podeGerenciar: manager }),
      workerConfigurado: () => worker, louvorStudioAdmin: admin,
    },
    '@/lib/louvorStudioStorage': { criarUrlDeLeitura: async () => '' },
  });
  return { POST, inserted: () => inserted };
}
const projectRequest = (extra = {}) => new Request('http://localhost/api/louvor-studio/projects', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://youtu.be/5QHF5OQeFOs', escalaId: 'scale', titulo: 'Song', ...extra }),
});

test('preparing without a chosen key creates a queued project with no target key', async () => {
  for (const extra of [{}, { tomAlvo: null }, { tomAlvo: '' }, { tomAlvo: '  ' }]) {
    const handler = projectRoute();
    const response = await handler.POST(projectRequest(extra));
    assert.equal(response.status, 202);
    const project = (await response.json()).projeto;
    assert.equal(project.tom_alvo, null);
    assert.equal(project.status, 'aguardando');
    assert.equal(project.escala_id, 'scale');
    assert.equal(handler.inserted().tom_original, null);
  }
});

test('existing clients can still provide a target key', async () => {
  const handler = projectRoute();
  assert.equal((await handler.POST(projectRequest({ tomAlvo: 'Dm' }))).status, 202);
  assert.equal(handler.inserted().tom_alvo, 'Dm');
});

test('optional key keeps permission, worker and selected-scale checks intact', async () => {
  for (const [options, status] of [
    [{ authorized: false }, 401], [{ manager: false }, 403],
    [{ worker: false }, 503], [{ validScale: false }, 400],
  ]) {
    const handler = projectRoute(options);
    assert.equal((await handler.POST(projectRequest())).status, status);
    assert.equal(handler.inserted(), undefined);
  }
  const handler = projectRoute();
  assert.equal((await handler.POST(projectRequest({ escalaId: undefined }))).status, 202);
  assert.equal(handler.inserted().escala_id, null);
});
