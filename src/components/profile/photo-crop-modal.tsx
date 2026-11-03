import { useCallback, useEffect, useRef, useState } from "react";

import { I } from "@/components/prototype/ui";
import { WkModal } from "@/components/workspace-settings/wk-modal";
import {
  PROFILE_PHOTO_MAX_ZOOM,
  PROFILE_PHOTO_OUTPUT,
  clampPos,
  coverScale,
  cropRect,
  repositionForScale,
  type Pos,
} from "@/lib/utils/photo-crop";

const VIEW = 280;
const STEP = 12;

interface Props {
  file: File;
  pending: boolean;
  /** Mensagem de erro do envio, mostrada dentro do diálogo para não perder o recorte. */
  error?: string | null;
  onClose: () => void;
  onConfirm: (cropped: Blob) => void;
}

/** Pré-visualização + recorte circular (arrastar e zoom). Entrega um JPEG quadrado de 512 px. */
export function PhotoCropModal({ file, pending, error, onClose, onConfirm }: Props) {
  const [src, setSrc] = useState<string>();
  const [size, setSize] = useState<{ w: number; h: number }>();
  const [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; start: Pos } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    setSize(undefined);
    setLoadError(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const base = size ? coverScale(size.w, size.h, VIEW) : 1;
  const scale = base * zoom;

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const s = coverScale(w, h, VIEW);
    setSize({ w, h });
    setZoom(1);
    setPos(clampPos({ x: (VIEW - w * s) / 2, y: (VIEW - h * s) / 2 }, w, h, s, VIEW));
  };

  const move = useCallback(
    (next: Pos, s = scale) => {
      if (size) setPos(clampPos(next, size.w, size.h, s, VIEW));
    },
    [size, scale],
  );

  const changeZoom = (z: number) => {
    if (!size) return;
    const nextScale = base * z;
    setZoom(z);
    setPos((p) => clampPos(repositionForScale(p, scale, nextScale, VIEW), size.w, size.h, nextScale, VIEW));
  };

  const confirm = () => {
    const img = imgRef.current;
    if (!img || !size) return;
    const { sx, sy, size: side } = cropRect(pos, scale, VIEW);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = PROFILE_PHOTO_OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, PROFILE_PHOTO_OUTPUT, PROFILE_PHOTO_OUTPUT);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, PROFILE_PHOTO_OUTPUT, PROFILE_PHOTO_OUTPUT);
    canvas.toBlob((blob) => blob && onConfirm(blob), "image/jpeg", 0.9);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = {
      ArrowLeft: [STEP, 0],
      ArrowRight: [-STEP, 0],
      ArrowUp: [0, STEP],
      ArrowDown: [0, -STEP],
    }[e.key];
    if (!d) return;
    e.preventDefault();
    move({ x: pos.x + d[0], y: pos.y + d[1] });
  };

  const ready = !!size && !loadError;

  return (
    <WkModal
      cls="wkm pcm"
      sub="Foto de perfil"
      title="Ajuste sua foto"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <button type="button" className="btn out" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            onClick={confirm}
            disabled={!ready || pending}
            aria-busy={pending}
          >
            {pending ? <I n="refresh" cls="sm spin" /> : <I n="check" cls="sm" />}
            {pending ? "Enviando…" : "Salvar foto"}
          </button>
        </>
      }
    >
      <div className="pcm-b">
        {loadError ? (
          <p className="pcm-err" role="alert">
            Não foi possível abrir essa imagem. Escolha outro arquivo.
          </p>
        ) : (
          <>
            <div
              className="pcm-vp"
              style={{ width: VIEW, height: VIEW }}
              tabIndex={0}
              role="group"
              aria-label="Área de recorte. Arraste a imagem ou use as setas para posicionar."
              onKeyDown={onKeyDown}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, start: pos };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (d)
                  move({
                    x: d.start.x + e.clientX - d.x,
                    y: d.start.y + e.clientY - d.y,
                  });
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              {src ? (
                <img
                  ref={imgRef}
                  src={src}
                  alt=""
                  draggable={false}
                  onLoad={onLoad}
                  onError={() => setLoadError(true)}
                  style={
                    size
                      ? {
                          width: size.w * scale,
                          height: size.h * scale,
                          transform: `translate(${pos.x}px, ${pos.y}px)`,
                        }
                      : { visibility: "hidden" }
                  }
                />
              ) : null}
              <span className="pcm-mask" aria-hidden="true" />
            </div>
            <label className="pcm-z">
              <span>Zoom</span>
              <input
                type="range"
                min={1}
                max={PROFILE_PHOTO_MAX_ZOOM}
                step={0.01}
                value={zoom}
                disabled={!ready || pending}
                onChange={(e) => changeZoom(Number(e.target.value))}
                aria-label="Zoom da foto"
              />
            </label>
            <p className="wkm-hn">Arraste para posicionar. A foto aparece em formato circular.</p>
          </>
        )}
        {error ? (
          <p className="pcm-err" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </WkModal>
  );
}
