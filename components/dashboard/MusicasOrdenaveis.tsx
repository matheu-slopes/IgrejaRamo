"use client";

import { useState, type ReactNode } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import type { EscalaMusica } from "@/types";

type Controles = { alca: ReactNode; setas: ReactNode };
type Props = {
  musicas: EscalaMusica[];
  onReorder: (musicas: EscalaMusica[]) => void;
  children: (musica: EscalaMusica, index: number, controles: Controles) => ReactNode;
};

function Item({ musica, index, total, mover, children }: {
  musica: EscalaMusica;
  index: number;
  total: number;
  mover: (direcao: -1 | 1) => void;
  children: (controles: Controles) => ReactNode;
}) {
  const dragControls = useDragControls();
  return <Reorder.Item as="div" value={musica.musicaId} dragListener={false} dragControls={dragControls}
    className="relative" whileDrag={{ zIndex: 10 }}>
    {children({
      alca: <button type="button" onPointerDown={(event) => dragControls.start(event)}
        aria-label={`Arrastar ${musica.titulo} para reordenar`} title="Arraste para mudar a ordem"
        className="touch-none select-none cursor-grab rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500">
        <GripVertical className="h-4 w-4" />
      </button>,
      setas: <div className="flex shrink-0 flex-col">
        <button type="button" onClick={() => mover(-1)} disabled={index === 0}
          aria-label={`Subir ${musica.titulo}`} title="Subir música"
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => mover(1)} disabled={index === total - 1}
          aria-label={`Descer ${musica.titulo}`} title="Descer música"
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>,
    })}
  </Reorder.Item>;
}

export function MusicasOrdenaveis({ musicas, onReorder, children }: Props) {
  const [anuncio, setAnuncio] = useState("");
  function reordenar(ids: string[]) {
    const porId = new Map(musicas.map((musica) => [musica.musicaId, musica]));
    onReorder(ids.map((id) => porId.get(id)!));
  }
  function mover(index: number, direcao: -1 | 1) {
    const destino = index + direcao;
    if (destino < 0 || destino >= musicas.length) return;
    const ids = musicas.map((musica) => musica.musicaId);
    const [id] = ids.splice(index, 1);
    ids.splice(destino, 0, id);
    reordenar(ids);
    setAnuncio(`${musicas[index].titulo}, posição ${destino + 1} de ${musicas.length}.`);
  }
  return <>
    <Reorder.Group as="div" axis="y" values={musicas.map((musica) => musica.musicaId)} onReorder={reordenar} className="space-y-2">
      {musicas.map((musica, index) => <Item key={musica.musicaId} musica={musica} index={index} total={musicas.length} mover={(direcao) => mover(index, direcao)}>
        {(controles) => children(musica, index, controles)}
      </Item>)}
    </Reorder.Group>
    <p role="status" aria-live="polite" className="sr-only">{anuncio}</p>
  </>;
}
