const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadBeat() {
  const filename = path.resolve(__dirname, '..', 'lib/louvorStudioBeat.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return loaded.exports;
}

test('browser beat analysis aligns a known 120 BPM click grid', () => {
  const { estimateBeatOffset } = loadBeat();
  const sampleRate = 44100, bpm = 120, offset = .18;
  const samples = new Float32Array(sampleRate * 24);
  for (let start = Math.round(offset * sampleRate); start < samples.length; start += sampleRate / 2)
    for (let i = 0; i < 600 && start + i < samples.length; i++) samples[start + i] = .8 * Math.exp(-i / 90);
  const buffer = {
    length: samples.length, duration: samples.length / sampleRate,
    numberOfChannels: 2, sampleRate, getChannelData: () => samples,
  };
  const phase = estimateBeatOffset(buffer, bpm);
  assert.notEqual(phase, null);
  assert.ok(Math.abs(((phase - offset + .25) % .5) - .25) < .06);
});
