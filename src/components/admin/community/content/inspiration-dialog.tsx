import { useState } from "react";

import { I } from "@/components/prototype/ui";
import { AdminDialog, adminErrorMessage, adminToast } from "@/components/admin/platform";
import { useInspirationMutations } from "@/hooks/admin/use-admin-community-content";
import { videoPosterFile } from "@/lib/admin/video-poster";
import { getUploadUrl } from "@/lib/utils/api";
import { uploadCommunityImage } from "@/shared/services/groups";
import type { CommunityPostModeration } from "@/shared/services/community-posts";
import { LESSON_TITLE_MAX, type CommunityInspiration } from "@/shared/community-content.types";

import { CommunityPostPicker, inspirationFromPost } from "./community-post-picker";
import { InspirationStage } from "./inspiration-stage";

/** Nova inspiração ou edição: uma foto, um reel vertical 9:16 de 1080x1920, ou os dois. Só com vídeo, a capa sai de um quadro dele. */
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
  const [picking, setPicking] = useState(false);
  const [posterNote, setPosterNote] = useState(false);

  const titleBad = title.trim().length < 1 || title.length > LESSON_TITLE_MAX;
  // Com vídeo, a capa é opcional: se faltar, tiramos um quadro dele.
  const valid = !titleBad && (!!imageUrl || !!videoUrl);

  /** Tira um quadro do vídeo e envia como capa. `false` se não deu (codec sem suporte, vídeo de outro domínio…). */
  const makePoster = async (source: File | string): Promise<boolean> => {
    const file = await videoPosterFile(source);
    if (!file) return false;
    try {
      const uploaded = await uploadCommunityImage(file);
      setImageUrl(uploaded.url);
      setPosterNote(false);
      return true;
    } catch {
      return false;
    }
  };

  const onVideoUploaded = async (file: File) => {
    if (imageUrl) return;
    if (!(await makePoster(file))) setPosterNote(true);
  };

  const pickPost = (post: CommunityPostModeration) => {
    const from = inspirationFromPost(post);
    setImageUrl(from.imageUrl);
    setVideoUrl(from.videoUrl);
    setAuthor(from.authorId);
    if (!title.trim()) setTitle(from.title);
    setPosterNote(false);
    setPicking(false);
    // Vídeo sem capa: tenta tirar um quadro (só funciona se o servidor do vídeo liberar a leitura); senão pede uma foto.
    if (from.needsPoster) {
      setUploading(true);
      void makePoster(from.videoUrl).then((ok) => {
        if (!ok) setPosterNote(true);
        setUploading(false);
      });
    }
  };

  const submit = async () => {
    setTouched(true);
    if (!valid || pending || uploading) return;
    let image = imageUrl;
    if (!image) {
      setUploading(true);
      const made = await videoPosterFile((videoUrl.startsWith("/") ? getUploadUrl(videoUrl) : videoUrl) ?? videoUrl).then((file) => (file ? uploadCommunityImage(file).catch(() => null) : null));
      setUploading(false);
      if (!made) {
        setPosterNote(true);
        return;
      }
      image = made.url;
      setImageUrl(image);
    }
    const body = {
      title: title.trim(),
      image_url: image,
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
      title={picking ? "Escolher da comunidade" : inspiration ? "Editar inspiração" : "Nova inspiração"}
      description={picking ? "Publicações da comunidade com foto ou vídeo. A escolhida preenche foto, vídeo e autor." : "Aparece na aba Conteúdos do app, em formato vertical (9:16)."}
      busy={pending}
      dirty={inspiration ? true : title.trim() !== "" || !!imageUrl || !!videoUrl}
      onClose={onClose}
      footer={
        picking ? (
          <button type="button" className="btn out" onClick={() => setPicking(false)}>
            Voltar
          </button>
        ) : (
          <>
            <button type="button" className="btn out" disabled={pending} onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn" disabled={pending || uploading} onClick={() => void submit()}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </>
        )
      }
    >
      {picking ? (
        <CommunityPostPicker onPick={pickPost} />
      ) : (
      <>
      <div className="adm-insp">
        <InspirationStage imageUrl={imageUrl} videoUrl={videoUrl} onImage={setImageUrl} onVideo={setVideoUrl} onVideoUploaded={onVideoUploaded} needsCover={posterNote} invalid={touched && !imageUrl && !videoUrl} disabled={pending} onBusyChange={setUploading} />

        <div className="adm-insp-form">
          <div className="adm-field">
            <label htmlFor="insp-title">Título</label>
            <input id="insp-title" className="adm-input" value={title} maxLength={LESSON_TITLE_MAX} aria-invalid={touched && titleBad ? true : undefined} data-adm-autofocus onChange={(event) => setTitle(event.target.value)} />
            {touched && titleBad ? <small className="adm-media-err">Informe o título.</small> : null}
          </div>
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
          <button type="button" className="adm-insp-pick" disabled={pending} onClick={() => setPicking(true)}>
            <span>
              <b>Escolher da comunidade</b>
              <small>Usa a mídia e o autor de uma publicação que já existe.</small>
            </span>
            <I n="chev" />
          </button>
        </div>
      </div>
      </>
      )}
    </AdminDialog>
  );
}
