import { useRef, useState } from "react";

import { adminErrorMessage } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import { uploadCommunityImage, uploadCommunityVideo } from "@/shared/services/groups";

interface Props {
  videoUrl: string;
  thumbnailUrl: string;
  onVideo: (url: string) => void;
  onThumbnail: (url: string) => void;
  /** Tentou salvar sem o vídeo. */
  invalid?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

const url = (value: string) => (value.startsWith("/") ? (getUploadUrl(value) ?? value) : value);

/** Palco 16:9 da aula: o vídeo aparece como no app, com a capa (opcional) logo abaixo. */
export function LessonStage({ videoUrl, thumbnailUrl, onVideo, onThumbnail, invalid, disabled, onBusyChange }: Props) {
  const videoInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"video" | "image" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = disabled || busy !== null;

  const send = async (kind: "video" | "image", file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(kind);
    onBusyChange?.(true);
    try {
      if (kind === "video") onVideo((await uploadCommunityVideo(file)).url);
      else onThumbnail((await uploadCommunityImage(file)).url);
    } catch (failure) {
      setError(adminErrorMessage(failure, kind === "video" ? "Não foi possível enviar o vídeo." : "Não foi possível enviar a imagem."));
    } finally {
      setBusy(null);
      onBusyChange?.(false);
      if (videoInput.current) videoInput.current.value = "";
      if (imageInput.current) imageInput.current.value = "";
    }
  };

  return (
    <div className="adm-insp-stage">
      <div className="adm-insp-frame" data-wide="true" data-empty={videoUrl ? undefined : "true"} aria-busy={busy ? true : undefined}>
        {videoUrl ? (
          <video src={url(videoUrl)} poster={thumbnailUrl ? url(thumbnailUrl) : undefined} muted playsInline controls preload="metadata" aria-label="Prévia da aula" />
        ) : (
          <button type="button" className="adm-insp-empty" disabled={locked} onClick={() => videoInput.current?.click()}>
            <span aria-hidden="true">
              <I n="video" />
            </span>
            <b>Adicionar vídeo da aula</b>
            <small>Até 100 MB.</small>
          </button>
        )}
        {busy ? <span className="adm-insp-busy">{busy === "video" ? "Enviando vídeo…" : "Enviando capa…"}</span> : null}
      </div>

      {videoUrl ? (
        <div className="adm-insp-acts">
          <button type="button" disabled={locked} onClick={() => videoInput.current?.click()}>
            Trocar vídeo
          </button>
          <button type="button" disabled={locked} onClick={() => onVideo("")}>
            Remover
          </button>
        </div>
      ) : null}

      <div className="adm-insp-cover">
        <span className="adm-insp-thumb" data-wide="true" aria-hidden="true">
          {thumbnailUrl ? <img src={url(thumbnailUrl)} alt="" /> : <I n="image" />}
        </span>
        <span>
          <b>
            Capa <em>opcional</em>
          </b>
          <small>Imagem 16:9, até 5 MB.</small>
        </span>
        <span className="adm-insp-cover-acts">
          <button type="button" disabled={locked} onClick={() => imageInput.current?.click()}>
            {thumbnailUrl ? "Trocar" : "Enviar"}
          </button>
          {thumbnailUrl ? (
            <button type="button" disabled={locked} onClick={() => onThumbnail("")}>
              Remover
            </button>
          ) : null}
        </span>
      </div>

      {invalid && !videoUrl ? (
        <small className="adm-media-err" role="alert">
          Envie o vídeo da aula para continuar.
        </small>
      ) : null}
      {error ? (
        <small className="adm-media-err" role="alert">
          {error}
        </small>
      ) : null}

      <input ref={videoInput} type="file" hidden accept="video/mp4,video/quicktime,video/x-m4v,video/webm" onChange={(event) => void send("video", event.target.files?.[0])} />
      <input ref={imageInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => void send("image", event.target.files?.[0])} />
    </div>
  );
}
