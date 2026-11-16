import { useState } from "react";

import { AdminDialog, adminErrorMessage, adminToast } from "@/components/admin/platform";
import { useInspirationMutations } from "@/hooks/admin/use-admin-community-content";
import { LESSON_TITLE_MAX, type CommunityInspiration } from "@/shared/community-content.types";

import { MediaUploadField } from "./media-upload-field";

/** Nova inspiração ou edição: foto (ou poster, quando há vídeo) e, se quiser, um reel vertical 9:16 de 1080x1920. */
export function InspirationDialog({ inspiration, onClose }: { inspiration?: CommunityInspiration; onClose: () => void }) {
  const { create, update } = useInspirationMutations();
  const pending = create.isPending || update.isPending;
  const [title, setTitle] = useState(inspiration?.title ?? "");
  const [imageUrl, setImageUrl] = useState(inspiration?.image_url ?? "");
  const [videoUrl, setVideoUrl] = useState(inspiration?.video_url ?? "");
  const [author, setAuthor] = useState(inspiration?.author_id !== null && inspiration?.author_id !== undefined ? String(inspiration.author_id) : "");
  const [source, setSource] = useState(inspiration?.source ?? "");
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState(false);

  const titleBad = title.trim().length < 1 || title.length > LESSON_TITLE_MAX;
  const valid = !titleBad && !!imageUrl;

  const submit = async () => {
    setTouched(true);
    if (!valid || pending || uploading) return;
    const body = {
      title: title.trim(),
      image_url: imageUrl,
      video_url: videoUrl || null,
      author_id: author.trim() || null,
      source: source.trim() || null,
    };
    try {
      if (inspiration) await update.mutateAsync({ id: inspiration.id, body });
      else await create.mutateAsync(body);
      adminToast.success(inspiration ? "Inspiração salva." : "Inspiração criada.");
      onClose();
    } catch (failure) {
      adminToast.error(adminErrorMessage(failure, "Não foi possível salvar a inspiração."));
    }
  };

  return (
    <AdminDialog
      open
      size="lg"
      title={inspiration ? "Editar inspiração" : "Nova inspiração"}
      description="Aparece na aba Conteúdos do app, em formato vertical (9:16)."
      busy={pending}
      dirty={inspiration ? true : title.trim() !== "" || !!imageUrl}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn out" disabled={pending} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={pending || uploading} onClick={() => void submit()}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <div className="adm-field">
        <label htmlFor="insp-title">Título</label>
        <input id="insp-title" className="adm-input" value={title} maxLength={LESSON_TITLE_MAX} aria-invalid={touched && titleBad ? true : undefined} data-adm-autofocus onChange={(event) => setTitle(event.target.value)} />
        {touched && titleBad ? <small className="adm-media-err">Informe o título.</small> : null}
      </div>

      <div className="adm-content-grid">
        <MediaUploadField label="Foto ou poster" kind="image" required ratio="9 / 16" value={imageUrl} onChange={setImageUrl} invalid={touched} disabled={pending} onBusyChange={setUploading} hint="Foto vertical; com vídeo, é o poster. Até 5 MB." />
        <MediaUploadField label="Vídeo (reel)" kind="video" ratio="9 / 16" value={videoUrl} onChange={setVideoUrl} disabled={pending} onBusyChange={setUploading} hint="Vertical 9:16, 1080x1920. Até 100 MB." />
      </div>

      <div className="adm-content-grid">
        <div className="adm-field">
          <label htmlFor="insp-author">
            Autor <span>opcional</span>
          </label>
          <input id="insp-author" className="adm-input" inputMode="numeric" placeholder="Id do usuário" value={author} onChange={(event) => setAuthor(event.target.value.trim())} />
          <small>Quem publicou.</small>
        </div>
        <div className="adm-field">
          <label htmlFor="insp-source">
            Marca <span>opcional</span>
          </label>
          <input id="insp-source" className="adm-input" value={source} onChange={(event) => setSource(event.target.value)} />
          <small>Nome da marca quando não há autor.</small>
        </div>
      </div>
    </AdminDialog>
  );
}
