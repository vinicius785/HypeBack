import { useRef, useState } from "react";

import { adminErrorMessage } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import { uploadCommunityImage, uploadCommunityVideo } from "@/shared/services/groups";

interface Props {
  imageUrl: string;
  videoUrl: string;
  onImage: (url: string) => void;
  onVideo: (url: string) => void;
  /** Depois de enviar um vídeo novo (ex.: tirar a capa dele). */
  onVideoUploaded?: (file: File) => void | Promise<void>;
  /** A capa automática falhou: pede uma foto. */
  needsCover?: boolean;
  /** Tentou salvar sem nenhuma mídia. */
  invalid?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

const url = (value: string) => (value.startsWith("/") ? (getUploadUrl(value) ?? value) : value);

/** Palco 9:16 da inspiração: o vídeo (ou a foto) aparece como no app, com as ações logo abaixo. */
export function InspirationStage({ imageUrl, videoUrl, onImage, onVideo, onVideoUploaded, needsCover, invalid, disabled, onBusyChange }: Props) {
  const videoInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"video" | "image" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (kind: "video" | "image", file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(kind);
    onBusyChange?.(true);
    try {
      if (kind === "video") {
        const uploaded = await uploadCommunityVideo(file);
        onVideo(uploaded.url);
        await onVideoUploaded?.(file);
      } else {
        const uploaded = await uploadCommunityImage(file);
        onImage(uploaded.url);
      }
    } catch (failure) {
      setError(adminErrorMessage(failure, kind === "video" ? "Não foi possível enviar o vídeo." : "Não foi possível enviar a imagem."));
    } finally {
      setBusy(null);
      onBusyChange?.(false);
      if (videoInput.current) videoInput.current.value = "";
      if (imageInput.current) imageInput.current.value = "";
    }
  };

  const hasMedia = !!videoUrl || !!imageUrl;
  const locked = disabled || busy !== null;

  return (
    <div className="adm-insp-stage">
      <div className="adm-insp-frame" data-empty={hasMedia ? undefined : "true"} aria-busy={busy ? true : undefined}>
        {videoUrl ? (
          <video src={url(videoUrl)} poster={imageUrl ? url(imageUrl) : undefined} muted playsInline controls preload="metadata" aria-label="Prévia do vídeo" />
        ) : imageUrl ? (
          <img src={url(imageUrl)} alt="Prévia da foto" />
        ) : (
          <button type="button" className="adm-insp-empty" disabled={locked} onClick={() => videoInput.current?.click()}>
            <span aria-hidden="true">
              <I n="video" />
            </span>
            <b>Adicionar vídeo</b>
            <small>Vertical 9:16, 1080x1920. Até 100 MB.</small>
          </button>
        )}
        {busy ? <span className="adm-insp-busy">{busy === "video" ? "Enviando vídeo…" : "Enviando foto…"}</span> : null}
      </div>

      <div className="adm-insp-acts">
        {videoUrl ? (
          <>
            <button type="button" disabled={locked} onClick={() => videoInput.current?.click()}>
              Trocar vídeo
            </button>
            <button type="button" disabled={locked} onClick={() => onVideo("")}>
              Remover
            </button>
          </>
        ) : imageUrl ? (
          <>
            <button type="button" disabled={locked} onClick={() => imageInput.current?.click()}>
              Trocar foto
            </button>
            <button type="button" disabled={locked} onClick={() => onImage("")}>
              Remover
            </button>
            <button type="button" disabled={locked} onClick={() => videoInput.current?.click()}>
              Adicionar vídeo
            </button>
          </>
        ) : (
          <button type="button" disabled={locked} onClick={() => imageInput.current?.click()}>
            Ou use só uma foto
          </button>
        )}
      </div>

      {videoUrl ? (
        <div className="adm-insp-cover" data-need={needsCover ? "true" : undefined}>
          <span className="adm-insp-thumb" aria-hidden="true">
            {imageUrl ? <img src={url(imageUrl)} alt="" /> : <I n="image" />}
          </span>
          <span>
            <b>Capa</b>
            <small>{imageUrl ? "Aparece antes do vídeo tocar." : needsCover ? "Não deu para tirar a capa do vídeo. Envie uma foto vertical." : "Sai de um quadro do vídeo."}</small>
          </span>
          <button type="button" disabled={locked} onClick={() => imageInput.current?.click()}>
            {imageUrl ? "Trocar" : "Enviar"}
          </button>
        </div>
      ) : null}

      {invalid && !hasMedia ? (
        <small className="adm-media-err" role="alert">
          Envie um vídeo ou uma foto para continuar.
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
