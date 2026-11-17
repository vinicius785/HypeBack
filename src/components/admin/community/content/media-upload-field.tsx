import { useRef, useState } from "react";

import { adminErrorMessage } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import { uploadCommunityImage, uploadCommunityVideo } from "@/shared/services/groups";

interface Props {
  label: string;
  kind: "image" | "video";
  /** Endereço já guardado (https ou /uploads/…). Vazio: nada enviado. */
  value: string;
  onChange: (url: string) => void;
  /** Formato do quadro de prévia: capa da aula (16:9) ou reel e poster da inspiração (9:16). */
  ratio: "16 / 9" | "9 / 16";
  hint?: string;
  required?: boolean;
  /** Mostra o "campo obrigatório" depois de tentar salvar. */
  invalid?: boolean;
  disabled?: boolean;
  /** Só avisa que está enviando, para o diálogo travar o "Salvar". */
  onBusyChange?: (busy: boolean) => void;
  /** Confere o arquivo antes de enviar (ex.: dimensões da imagem). Devolve o motivo da recusa, ou `null` se serve. */
  validate?: (file: File) => Promise<string | null>;
}

/** Envia o arquivo na hora (imagem até 5 MB, vídeo até 100 MB) e guarda só o endereço devolvido, com prévia no formato certo. */
export function MediaUploadField({ label, kind, value, onChange, ratio, hint, required, invalid, disabled, onBusyChange, validate }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = value ? (value.startsWith("/") ? getUploadUrl(value) : value) : undefined;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    onBusyChange?.(true);
    try {
      const problem = await validate?.(file);
      if (problem) {
        setError(problem);
        return;
      }
      const uploaded = kind === "video" ? await uploadCommunityVideo(file) : await uploadCommunityImage(file);
      onChange(uploaded.url);
    } catch (failure) {
      setError(adminErrorMessage(failure, kind === "video" ? "Não foi possível enviar o vídeo." : "Não foi possível enviar a imagem."));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="adm-field adm-media">
      <label>
        {label} {required ? null : <span>opcional</span>}
      </label>
      <div className="adm-media-row">
        <div className="adm-media-pv" style={{ aspectRatio: ratio }} data-ratio={ratio === "9 / 16" ? "tall" : "wide"} aria-busy={busy || undefined}>
          {src && kind === "video" ? (
            <video src={src} muted playsInline controls preload="metadata" aria-label={`Prévia: ${label}`} />
          ) : src ? (
            <img src={src} alt={`Prévia: ${label}`} />
          ) : (
            <span className="adm-media-empty" aria-hidden="true">
              <I n={kind === "video" ? "video" : "image"} />
            </span>
          )}
          {busy ? <span className="adm-media-busy">Enviando…</span> : null}
        </div>
        <div className="adm-media-act">
          <button type="button" className="btn out adm-btn-sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
            {value ? "Trocar arquivo" : kind === "video" ? "Escolher vídeo" : "Escolher imagem"}
          </button>
          {value ? (
            <button type="button" className="btn out adm-btn-sm" disabled={disabled || busy} onClick={() => onChange("")}>
              Remover
            </button>
          ) : null}
          {hint ? <small>{hint}</small> : null}
          {invalid && !value ? (
            <small className="adm-media-err" role="alert">
              Envie este arquivo para continuar.
            </small>
          ) : null}
          {error ? (
            <small className="adm-media-err" role="alert">
              {error}
            </small>
          ) : null}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={kind === "video" ? "video/mp4,video/quicktime,video/x-m4v,video/webm" : "image/jpeg,image/png,image/webp"}
        onChange={(event) => void pick(event.target.files?.[0])}
      />
    </div>
  );
}
