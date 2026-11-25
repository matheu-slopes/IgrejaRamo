const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const source=fs.readFileSync('components/chat/MidiaPrivada.tsx','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const m={exports:{}};
new Function('exports','module','require',js)(m.exports,m,(name)=>name==='@/lib/authHeaders'?{authJsonHeaders:async()=>({})}:require(name));
const {ImagemDeMensagem,AudioDeMensagem}=m.exports;
test('preserva imagens e áudios antigos por URL',()=>{
  const imagem=renderToStaticMarkup(React.createElement(ImagemDeMensagem,{referencia:'https://example.com/antiga.jpg',mensagemId:'id',tipo:'conversa',alt:'imagem'}));
  const audio=renderToStaticMarkup(React.createElement(AudioDeMensagem,{referencia:'https://example.com/antigo.webm',mensagemId:'id',tipo:'ministerio'}));
  assert.match(imagem,/src="https:\/\/example.com\/antiga.jpg"/);
  assert.match(audio,/src="https:\/\/example.com\/antigo.webm"/);
});
test('não expõe identificadores privados como URLs em elementos de mídia',()=>{
  const imagem=renderToStaticMarkup(React.createElement(ImagemDeMensagem,{referencia:'r2midia:chat/chave/imagem.jpg',mensagemId:'id',tipo:'conversa',alt:'imagem'}));
  assert.match(imagem,/Carregando imagem/); assert.doesNotMatch(imagem,/src="r2midia:/);
});
