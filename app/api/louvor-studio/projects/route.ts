import { NextRequest, NextResponse } from "next/server";
import {
  chamarLouvorStudioWorker,
  getLouvorStudioUser,
  louvorStudioAdmin,
  podeUsarLouvorStudio,
  workerConfigurado,
} from "@/lib/louvorStudioServer";

type ProjetoRow = {
  id: string;
  audio_path?: string | null;
  stems?: Record<string, string> | null;
  [key: string]: unknown;
};

async function autorizar(req: NextRequest) {
  const user = await getLouvorStudioUser(req);
  if (!user) return null;
  return (await podeUsarLouvorStudio(user.id)) ? user : null;
}

async function assinarProjeto(projeto: ProjetoRow) {
  const paths = [projeto.audio_path, ...Object.values(projeto.stems ?? {})].filter(Boolean) as string[];
  const urls: Record<string, string> = {};

  await Promise.all(paths.map(async (path) => {
    const { data } = await louvorStudioAdmin.storage.from("louvor-studio").createSignedUrl(path, 6 * 60 * 60);
    if (data?.signedUrl) urls[path] = data.signedUrl;
  }));

  const stemUrls = Object.fromEntries(
    Object.entries(projeto.stems ?? {}).map(([nome, path]) => [nome, urls[path] ?? null])
  );

  return {
    ...projeto,
    audio_url: projeto.audio_path ? urls[projeto.audio_path] ?? null : null,
    stem_urls: stemUrls,
    audio_path: undefined,
    stems: undefined,
  };
}

export async function GET(req: NextRequest) {
  if (!(await autorizar(req))) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { data, error } = await louvorStudioAdmin
    .from("louvor_studio_projetos")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projetos: await Promise.all((data ?? []).map((p) => assinarProjeto(p as ProjetoRow))) });
}

export async function POST(req: NextRequest) {
  const user = await autorizar(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!workerConfigurado()) {
    return NextResponse.json({ error: "O processador do Louvor Studio ainda não foi configurado." }, { status: 503 });
  }

  const body = await req.json().catch(() => null) as {
    url?: string; titulo?: string; artista?: string; thumbnailUrl?: string;
  } | null;
  const url = body?.url?.trim();
  if (!url || !/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Link de música inválido." }, { status: 400 });

  const { data: projeto, error } = await louvorStudioAdmin
    .from("louvor_studio_projetos")
    .insert({
      criado_por: user.id,
      youtube_url: url,
      titulo: body?.titulo?.trim() || "Processando música",
      artista: body?.artista?.trim() || null,
      thumbnail_url: body?.thumbnailUrl || null,
    })
    .select("*")
    .single();

  if (error || !projeto) return NextResponse.json({ error: error?.message ?? "Não foi possível criar o projeto." }, { status: 500 });

  try {
    const workerResponse = await chamarLouvorStudioWorker("/jobs", {
      method: "POST",
      body: JSON.stringify({ projeto_id: projeto.id, youtube_url: url }),
    });
    if (!workerResponse.ok) {
      const workerError = await workerResponse.json().catch(() => null) as { error?: string } | null;
      throw new Error(workerError?.error || "O processador recusou a tarefa.");
    }
  } catch (workerError) {
    const message = workerError instanceof Error ? workerError.message : "Processador indisponível.";
    await louvorStudioAdmin.from("louvor_studio_projetos")
      .update({ status: "erro", erro: message, atualizado_em: new Date().toISOString() })
      .eq("id", projeto.id);
    return NextResponse.json({ error: message }, { status: 503 });
  }

  return NextResponse.json({ projeto }, { status: 202 });
}

