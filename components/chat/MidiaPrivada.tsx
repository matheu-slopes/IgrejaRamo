"use client";

import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { authJsonHeaders } from "@/lib/authHeaders";

type Props = {
  referencia?: string;
  mensagemId: string;
  tipo: "conversa" | "ministerio" | "perfil" | "grupo";
  renovarAutomaticamente?: boolean;
  children: (url: string | undefined, atualizar: () => void, falhou: boolean) => ReactNode;
};

/** URLs antigas são preservadas. Referências privadas são resolvidas em memória. */
export function MidiaPrivada({ referencia, mensagemId, tipo, renovarAutomaticamente = true, children }: Props) {
  const [versao, setVersao] = useState(0);
  const [estado, setEstado] = useState<{ referencia: string; url?: string; falhou?: boolean }>({ referencia: "" });

  useEffect(() => {
    if (!referencia?.startsWith("r2midia:")) return;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tentativas = 0;
    const controller = new AbortController();

    async function carregar() {
      try {
        const response = await fetch("/api/midias/autorizar", {
          method: "POST", headers: await authJsonHeaders(),
          body: JSON.stringify({ mensagemId, tipo }), signal: controller.signal,
        });
        const data = await response.json().catch(() => null) as { url?: unknown } | null;
        if (cancelado) return;
        if (response.ok && typeof data?.url === "string") {
          setEstado({ referencia: referencia!, url: data.url });
          if (renovarAutomaticamente) timer = setTimeout(carregar, 240_000);
          return;
        }
        // O arquivo pode ter sido enviado antes de a mensagem ser persistida.
        if ((response.status === 404 || response.status === 503) && tentativas++ < 4) {
          timer = setTimeout(carregar, 2000);
        } else setEstado({ referencia: referencia!, falhou: true });
      } catch {
        if (!cancelado && tentativas++ < 4) timer = setTimeout(carregar, 2000);
        else if (!cancelado) setEstado({ referencia: referencia!, falhou: true });
      }
    }
    void carregar();
    return () => { cancelado = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [referencia, mensagemId, tipo, versao, renovarAutomaticamente]);

  const url = !referencia?.startsWith("r2midia:") ? referencia : estado.referencia === referencia ? estado.url : undefined;
  return children(url, () => { if (referencia) setEstado({ referencia }); setVersao((value) => value + 1); }, estado.referencia === referencia && Boolean(estado.falhou));
}

type ElementoProps = Omit<Props, "children" | "renovarAutomaticamente">;

function ImagemResolvida({ url, atualizar, falhou, abrir, ...props }: { url?: string; atualizar: () => void; falhou: boolean; abrir?: boolean } & ImgHTMLAttributes<HTMLImageElement>) {
  const [erro, setErro] = useState(false);
  useEffect(() => { setErro(false); }, [url]);
  if (erro || falhou) return <button type="button" onClick={() => { setErro(false); atualizar(); }} className="rounded-lg bg-gray-100 p-3 text-xs text-gray-600">Não foi possível carregar. Toque para tentar novamente.</button>;
  if (!url) return <span className="block p-3 text-xs text-gray-500">Carregando imagem...</span>;
  return <img {...props} src={url} onError={() => setErro(true)} onClick={abrir ? () => window.open(url, "_blank", "noopener,noreferrer") : props.onClick} />;
}

export function ImagemDeMensagem({ referencia, mensagemId, tipo, abrir, ...props }: ElementoProps & { abrir?: boolean } & ImgHTMLAttributes<HTMLImageElement>) {
  return <MidiaPrivada referencia={referencia} mensagemId={mensagemId} tipo={tipo}>{(url, atualizar, falhou) => <ImagemResolvida {...props} url={url} atualizar={atualizar} falhou={falhou} abrir={abrir} />}</MidiaPrivada>;
}

function AudioResolvido({ url, atualizar, falhou, className }: { url?: string; atualizar: () => void; falhou: boolean; className?: string }) {
  const [erro, setErro] = useState(false);
  useEffect(() => { setErro(false); }, [url]);
  if (erro || falhou) return <button type="button" onClick={() => { setErro(false); atualizar(); }} className="rounded-lg bg-gray-100 p-2 text-xs text-gray-600">Áudio indisponível. Toque para tentar novamente.</button>;
  if (!url) return <span className="block p-2 text-xs text-gray-500">Carregando áudio...</span>;
  return <audio controls preload="metadata" src={url} className={className} onError={() => setErro(true)} />;
}

export function AudioDeMensagem({ referencia, mensagemId, tipo, className }: ElementoProps & { className?: string }) {
  return <MidiaPrivada referencia={referencia} mensagemId={mensagemId} tipo={tipo} renovarAutomaticamente={false}>{(url, atualizar, falhou) => <AudioResolvido url={url} atualizar={atualizar} falhou={falhou} className={className} />}</MidiaPrivada>;
}
