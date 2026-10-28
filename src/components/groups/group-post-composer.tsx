/**
 * Composer de publicação no grupo — permite enviar mensagens/posts para o grupo
 * direto pelo Backoffice, sem abrir o app.
 *
 * O anexo é opcional e usa upload deferido: o arquivo só sobe no submit, e a
 * `url` retornada vai em `image_url`/`video_url` do post (mesmo fluxo da capa
 * do grupo).
 *
 * Imagem e vídeo são mutuamente exclusivos: o card do app renderiza um OU
 * outro, então deixar os dois anexados só criaria a expectativa de um carrossel
 * que não existe.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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
  | {
      kind: "video";
      file: File;
      /** Primeiro frame extraído no navegador. `null` quando o decode falhou. */
      poster: File | null;
    };

export function GroupPostComposer({ groupId }: { groupId: string }) {
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

  // objectURL precisa ser revogado para não vazar memória entre trocas de anexo.
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
      toast.error(error);
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
      toast.error(error);
      return;
    }

    setProbing(true);
    try {
      const { durationSeconds, poster } = await probeVideoFile(file);
      // `0` = o navegador não conseguiu ler a duração (container que ele não
      // decodifica). Não é motivo pra barrar: o limite de tamanho já protege.
      if (durationSeconds > COMMUNITY_VIDEO_LIMITS.maxDurationSeconds) {
        const limitMinutes = COMMUNITY_VIDEO_LIMITS.maxDurationSeconds / 60;
        toast.error(
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
          // Poster é imagem: vai pela rota de imagem mesmo. Se falhar, o post
          // ainda vale — o player abre sem capa em vez de perder o vídeo.
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
        // Só manda as chaves de vídeo quando há vídeo — mantém o payload
        // idêntico ao de antes para os posts de texto/imagem.
        ...(videoUrl
          ? { video_url: videoUrl, video_thumbnail_url: videoThumbnailUrl }
          : {}),
      });
      setContent("");
      setAttachment(null);
      toast.success("Conteúdo publicado no grupo.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível publicar.",
      );
    }
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Publicar no grupo
      </h3>

      <textarea
        rows={3}
        maxLength={MAX_CONTENT}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          // Enter quebra linha; Ctrl/Cmd + Enter publica.
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder="Escreva o aviso, mensagem ou link que os membros vão ver no grupo"
        className="resize-y rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
      />

      {preview && attachment?.kind === "image" && (
        <div className="relative w-fit">
          <img
            src={preview}
            alt="Prévia da imagem do conteúdo"
            className="max-h-48 rounded-xl object-cover"
          />
          <RemoveAttachmentButton
            disabled={isSubmitting}
            label="Remover imagem"
            onClick={() => setAttachment(null)}
          />
        </div>
      )}

      {preview && attachment?.kind === "video" && (
        <div className="relative w-fit">
          <video
            src={preview}
            controls
            playsInline
            aria-label="Prévia do vídeo do conteúdo"
            className="max-h-48 rounded-xl bg-black"
          />
          <RemoveAttachmentButton
            disabled={isSubmitting}
            label="Remover vídeo"
            onClick={() => setAttachment(null)}
          />
        </div>
      )}

      <input
        ref={imageRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleImage}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-m4v,video/webm"
        className="hidden"
        onChange={(event) => void handleVideo(event)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => imageRef.current?.click()}
            className="h-9 rounded-full px-4"
          >
            <Icon name="ImagePlus" size={16} color="#525252" />
            {attachment?.kind === "image" ? "Trocar imagem" : "Adicionar imagem"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => videoRef.current?.click()}
            className="h-9 rounded-full px-4"
          >
            <Icon name="Video" size={16} color="#525252" />
            {probing
              ? "Lendo vídeo..."
              : attachment?.kind === "video"
                ? "Trocar vídeo"
                : "Adicionar vídeo"}
          </Button>
          <span className="text-xs text-neutral-400">
            Ctrl/Cmd + Enter para publicar
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400">
            {content.length}/{MAX_CONTENT}
          </span>
          <Button
            type="submit"
            disabled={isBusy || content.trim().length === 0}
            className="h-9 rounded-full px-5"
          >
            {uploadVideo.isPending
              ? "Enviando vídeo..."
              : uploadImage.isPending
                ? "Enviando imagem..."
                : createPost.isPending
                  ? "Publicando..."
                  : "Publicar"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function RemoveAttachmentButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow-sm transition-colors hover:bg-white disabled:opacity-50"
    >
      <Icon name="X" size={14} color="#404040" />
    </button>
  );
}
