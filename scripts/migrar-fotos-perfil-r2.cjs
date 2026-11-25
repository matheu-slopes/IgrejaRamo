// Simulação: node --env-file=.env.local scripts/migrar-fotos-perfil-r2.cjs
// Execução: acrescente --executar somente após publicar o leitor de referências R2.
// Nunca imprime imagens, identificadores, URLs ou credenciais.
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const required=['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CLOUDFLARE_R2_ACCOUNT_ID','CLOUDFLARE_R2_MEDIA_BUCKET','CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID','CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY'];
const missing=required.filter((name)=>!process.env[name]);
if(missing.length){process.stderr.write(`Configuração ausente: ${missing.join(', ')}\n`);process.exit(1);}
if(process.env.CLOUDFLARE_R2_MEDIA_BUCKET===process.env.CLOUDFLARE_R2_BUCKET){process.stderr.write('O bucket de mídias deve ser separado do Studio.\n');process.exit(1);}
const executar=process.argv.includes('--executar');
if(executar&&process.env.MIGRACAO_FOTOS_LEITOR_PUBLICADO!=='true'){process.stderr.write('Confirme que o leitor de fotos R2 está publicado antes de executar.\n');process.exit(1);}
const js=ts.transpileModule(fs.readFileSync('lib/validarArquivoMidia.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('exports','module','require',js)(m.exports,m,require);
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket=process.env.CLOUDFLARE_R2_MEDIA_BUCKET;
const r2=new S3Client({region:'auto',endpoint:`https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:process.env.CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID,secretAccessKey:process.env.CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY}});

async function perfis(){const all=[];let offset=0;for(;;){const {data,error}=await db.from('perfis').select('id,foto').not('foto','is',null).order('id').range(offset,offset+999);if(error||!data)throw Error('Não foi possível consultar as fotos.');all.push(...data);if(data.length<1000)return all;offset+=data.length;}}
async function tamanhoR2(){let total=0,token;do{const page=await r2.send(new ListObjectsV2Command({Bucket:bucket,ContinuationToken:token}));for(const obj of page.Contents||[]){if(!Number.isSafeInteger(obj.Size)||obj.Size<0)throw Error('Medição incompleta.');total+=obj.Size;if(!Number.isSafeInteger(total))throw Error('Medição incompleta.');}if(page.IsTruncated&&!page.NextContinuationToken)throw Error('Medição incompleta.');token=page.IsTruncated?page.NextContinuationToken:undefined;}while(token);return total;}
function fotoValida(value){if(typeof value!=='string'||value.length>6000000)return null;const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match)return null;const bytes=Buffer.from(match[2],'base64');const check=m.exports.validarArquivoMidia(match[1],bytes);return check?{bytes,mime:match[1],ext:check.extensao}:null;}
async function migrar(perfil,foto){
  const id=crypto.randomUUID();const key=`perfis/${perfil.id.toLowerCase()}/${id}.${foto.ext}`;
  let reservado=false,enviado=false,adotado=false,resultadoIncerto=false;
  try{
    const start=await db.rpc('midias_r2_inicio_medicao');if(start.error||typeof start.data!=='string')throw Error('Cota indisponível.');
    const usados=await tamanhoR2();
    const res=await db.rpc('reservar_espaco_midias_r2',{p_id:id,p_bytes:foto.bytes.length,p_usados:usados,p_inicio:start.data});
    if(res.error||res.data?.permitido!==true)throw Error('Cota indisponível ou atingida.');reservado=true;
    await r2.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:foto.bytes,ContentType:foto.mime,CacheControl:'private, no-store'}));enviado=true;
    const objeto=await r2.send(new GetObjectCommand({Bucket:bucket,Key:key}));const copia=Buffer.from(await objeto.Body.transformToByteArray());
    const hash=(b)=>crypto.createHash('sha256').update(b).digest('hex');
    if(copia.length!==foto.bytes.length||hash(copia)!==hash(foto.bytes))throw Error('A verificação da cópia falhou.');
    // Se a resposta for perdida, a transação pode ter sido concluída: preserve a cópia.
    resultadoIncerto=true;
    const result=await db.rpc('migrar_foto_perfil_r2',{p_perfil:perfil.id,p_original:perfil.foto,p_nova:`r2midia:${key}`});
    if(result.error)throw Error('A atualização da referência falhou.');
    if(result.data===false){resultadoIncerto=false;return false;}
    if(result.data!==true)throw Error('Resultado da atualização não confirmado.');
    adotado=true;return true;
  }finally{
    if(enviado&&!adotado&&!resultadoIncerto){try{await r2.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));}catch{process.stderr.write('Uma cópia de teste não pôde ser removida; ela continua protegida pela cota.\n');}}
    if(reservado){const result=await db.rpc('finalizar_reserva_midias_r2',{p_id:id});if(result.error)process.stderr.write('Uma reserva será liberada automaticamente mais tarde.\n');}
  }
}
(async()=>{const lista=await perfis();let elegiveis=0,migradas=0,ignoradas=0;for(const p of lista){if(typeof p.foto==='string'&&p.foto.startsWith('r2midia:'))continue;const f=fotoValida(p.foto);if(!f){ignoradas++;continue;}elegiveis++;if(executar&&await migrar(p,f))migradas++;}process.stdout.write(JSON.stringify({modo:executar?'execução':'simulação',perfis_com_foto:lista.length,elegiveis,migradas,formatos_ignorados:ignoradas})+'\n');})().catch(()=>{process.stderr.write('A migração foi interrompida. Fotos não substituídas permanecem no banco; consulte os totais antes de tentar novamente.\n');process.exitCode=1;}).finally(()=>r2.destroy());
