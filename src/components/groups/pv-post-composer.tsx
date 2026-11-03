/**
 * Composer de publicação no grupo no padrão do protótipo (mesma lógica de
 * `group-post-composer.tsx`: upload deferido, imagem OU vídeo, poster do vídeo).
 */
import { useEffect, useId, useRef, useState } from "react";

import { adminErrorMessage, adminToast } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import {
  useCreateGroupPost,
  useUploadGroupCover,
  useUploadGroupVideo,
} from "@/hooks/use-groups";
import {
  COMMUNITY_VIDEO_LIMITS,
  probeVideoFile,
  validateCommunityVideoFile,
  validateGroupCoverFile,
} from "@/shared/services/groups";

const MAX_CONTENT = 2000;

type Attachment =
  | { kind: "image"; file: File }
  | { kind: "video"; file: File; poster: File | null };

interface PvPostComposerProps {
  groupId: string;
  /**
   * Avisa quando o composer está enviando (upload da mídia e publicação) ou lendo o vídeo. O diálogo que o contém
   * liga isso ao `busy` do `PvOverlay`: Esc e o fundo não fecham no meio do envio. Tem de ser estável (um `setState`).
   * Ao desmontar com envio em andamento, avisa que parou, para o diálogo não ficar travado.
   */
  onBusyChange?: (busy: boolean) => void;
}

export function PvPostComposer({ groupId, onBusyChange }: PvPostComposerProps) {
  const textId = useId();
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const createPost = useCreateGroupPost(groupId);
  const uploadImage = useUploadGroupCover();
  const uploadVideo = useUploadGroupVideo();
  const isSubmitting =
    createPost.isPending || uploadImage.isPending || uploadVideo.isPending;
  const isBusy = isSubmitting || probing;

  useEffect(() => {
    if (!isBusy || !onBusyChange) return;
    onBusyChange(true);
    return () => onBusyChange(false);
  }, [isBusy, onBusyChange]);

  useEffect(() => {
    if (!attachment) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(attachment.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  const handleImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const error = validateGroupCoverFile(file);
    if (error) {
      adminToast.error(error);
      return;
    }
    setAttachment({ kind: "image", file });
  };

  const handleVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const error = validateCommunityVideoFile(file);
    if (error) {
      adminToast.error(error);
      return;
    }
    setProbing(true);
    try {
      const { durationSeconds, poster } = await probeVideoFile(file);
      if (durationSeconds > COMMUNITY_VIDEO_LIMITS.maxDurationSeconds) {
        const limitMinutes = COMMUNITY_VIDEO_LIMITS.maxDurationSeconds / 60;
        adminToast.error(
          `O vídeo tem ${Math.round(durationSeconds)}s e o limite é de ${limitMinutes} minutos.`,
        );
        return;
      }
      setAttachment({ kind: "video", file, poster });
    } finally {
      setProbing(false);
    }
  };

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed || isBusy) return;
    try {
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      let videoThumbnailUrl: string | null = null;

      if (attachment?.kind === "image") {
        imageUrl = (await uploadImage.mutateAsync(attachment.file)).url;
      } else if (attachment?.kind === "video") {
        videoUrl = (await uploadVideo.mutateAsync(attachment.file)).url;
        if (attachment.poster) {
          try {
            videoThumbnailUrl = (await uploadImage.mutateAsync(attachment.poster))
              .url;
          } catch {
            videoThumbnailUrl = null;
          }
        }
      }

      await createPost.mutateAsync({
        content: trimmed,
        image_url: imageUrl,
        ...(videoUrl
          ? { video_url: videoUrl, video_thumbnail_url: videoThumbnailUrl }
          : {}),
      });
      setContent("");
      setAttachment(null);
      adminToast.success("Conteúdo publicado no grupo.");
    } catch (err) {
      adminToast.error(adminErrorMessage(err, "Não foi possível publicar."));
    }
  };

  return (
    <form
      className="gpx-cmp"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="n4l" style={{ margin: 0 }} htmlFor={textId}>
        Publicar no grupo
      </label>
      <textarea
        id={textId}
        className="cm-ta"
        rows={3}
        maxLength={MAX_CONTENT}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="Escreva o aviso, mensagem ou link que os membros vão ver no grupo"
      />
      {preview && attachment?.kind === "image" && (
        <div className="gpx-att">
          <img src={preview} alt="Prévia da imagem do conteúdo" />
          <button
            type="button"
            aria-label="Remover imagem"
            disabled={isSubmitting}
            onClick={() => setAttachment(null)}
          >
            <I n="x" cls="sm" />
          </button>
        </div>
      )}
      {preview && attachment?.kind === "video" && (
        <div className="gpx-att">
          <video
            src={preview}
            controls
            playsInline
            aria-label="Prévia do vídeo do conteúdo"
          />
          <button
            type="button"
            aria-label="Remover vídeo"
            disabled={isSubmitting}
            onClick={() => setAttachment(null)}
          >
            <I n="x" cls="sm" />
          </button>
        </div>
      )}
      <input
        ref={imageRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={handleImage}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-m4v,video/webm"
        hidden
        onChange={(e) => void handleVideo(e)}
      />
      <div className="gpx-cmp-r">
        <div>
          <button
            type="button"
            className="nbtn"
            disabled={isBusy}
            onClick={() => imageRef.current?.click()}
          >
            <I n="image" cls="sm" />
            {attachment?.kind === "image" ? "Trocar imagem" : "Imagem"}
          </button>
          <button
            type="button"
            className="nbtn"
            disabled={isBusy}
            onClick={() => videoRef.current?.click()}
          >
            <I n="video" cls="sm" />
            {probing
              ? "Lendo vídeo..."
              : attachment?.kind === "video"
                ? "Trocar vídeo"
                : "Vídeo"}
          </button>
          <small>Ctrl/Cmd + Enter para publicar</small>
        </div>
        <div>
          <small>
            {content.length}/{MAX_CONTENT}
          </small>
          <button
            type="submit"
            className="btn"
            disabled={isBusy || content.trim().length === 0}
          >
            {uploadVideo.isPending
              ? "Enviando vídeo..."
              : uploadImage.isPending
                ? "Enviando imagem..."
                : createPost.isPending
                  ? "Publicando..."
                  : "Publicar"}
          </button>
        </div>
      </div>
    </form>
  );
}
