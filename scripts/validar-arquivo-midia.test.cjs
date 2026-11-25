const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const src=fs.readFileSync('lib/validarArquivoMidia.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}}; new Function('exports','module','require',js)(m.exports,m,require);
const {validarArquivoMidia:validar}=m.exports;
test('aceita assinaturas esperadas e normaliza MIME de áudio',()=>{
  assert.equal(validar('audio/webm;codecs=opus',Uint8Array.from([0x1a,0x45,0xdf,0xa3])).extensao,'webm');
  assert.equal(validar('application/pdf',new TextEncoder().encode('%PDF-1.7')).extensao,'pdf');
  assert.equal(validar('image/png',Uint8Array.from([0x89,0x50,0x4e,0x47,13,10,26,10])).extensao,'png');
});
test('recusa MIME e conteúdo incompatíveis, vídeo, vazio e arquivos acima do limite',()=>{
  assert.equal(validar('image/jpeg',new TextEncoder().encode('arquivo')),null);
  assert.equal(validar('video/mp4',new Uint8Array([0,0,0,0,102,116,121,112])),null);
  assert.equal(validar('audio/webm',new Uint8Array()),null);
  assert.equal(validar('text/plain',new Uint8Array(4*1024*1024+1)),null);
});
