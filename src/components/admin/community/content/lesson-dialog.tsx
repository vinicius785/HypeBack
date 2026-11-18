import { useState } from "react";

import { AdminDialog, adminErrorMessage, adminToast } from "@/components/admin/platform";
import { useLessonMutations } from "@/hooks/admin/use-admin-community-content";
import {
  LESSON_CATEGORY_MAX,
  LESSON_DESCRIPTION_MAX,
  LESSON_POINTS_MAX,
  LESSON_TITLE_MAX,
  type CommunityLesson,
} from "@/shared/community-content.types";

import { formatDuration, parseDuration } from "./content-format";
import { LessonStage } from "./lesson-stage";

/** Nova aula ou edição (com `lesson`). Mudar o custo não cobra de novo quem já desbloqueou. */
export function LessonDialog({ lesson, onClose }: { lesson?: CommunityLesson; onClose: () => void }) {
  const { create, update } = useLessonMutations();
  const pending = create.isPending || update.isPending;
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson?.video_url ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(lesson?.thumbnail_url ?? "");
  const [points, setPoints] = useState(String(lesson?.points_cost ?? 0));
  const [duration, setDuration] = useState(formatDuration(lesson?.duration_seconds));
  const [category, setCategory] = useState(lesson?.category ?? "");
  const [instructor, setInstructor] = useState(lesson?.instructor_id !== null && lesson?.instructor_id !== undefined ? String(lesson.instructor_id) : "");
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState(false);

  const pointsNumber = Number(points);
  const pointsBad = points.trim() === "" || !Number.isInteger(pointsNumber) || pointsNumber < 0 || pointsNumber > LESSON_POINTS_MAX;
  const durationParsed = parseDuration(duration);
  const titleBad = title.trim().length < 1 || title.length > LESSON_TITLE_MAX;
  const valid = !titleBad && !!videoUrl && !pointsBad && durationParsed !== undefined;
  const dirty = lesson ? true : title.trim() !== "" || !!videoUrl;

  const submit = async () => {
    setTouched(true);
    if (!valid || pending || uploading || durationParsed === undefined) return;
    const body = {
      title: title.trim(),
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl || null,
      description: description.trim() || null,
      points_cost: pointsNumber,
      duration_seconds: durationParsed,
      category: category.trim() || null,
      instructor_id: instructor.trim() || null,
    };
    try {
      if (lesson) await update.mutateAsync({ id: lesson.id, body });
      else await create.mutateAsync(body);
      adminToast.success(lesson ? "Aula salva." : "Aula criada.");
      onClose();
    } catch (failure) {
      adminToast.error(adminErrorMessage(failure, "Não foi possível salvar a aula."));
    }
  };

  return (
    <AdminDialog
      open
      size="lg"
      title={lesson ? "Editar aula" : "Nova aula"}
      description={lesson ? "Mudar o custo não cobra de novo quem já desbloqueou a aula." : "Aparece na aba Conteúdos do app. Custo 0 deixa a aula livre."}
      busy={pending}
      dirty={dirty}
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
      <div className="adm-insp adm-lsn">
        <LessonStage videoUrl={videoUrl} thumbnailUrl={thumbnailUrl} onVideo={setVideoUrl} onThumbnail={setThumbnailUrl} invalid={touched} disabled={pending} onBusyChange={setUploading} />

        <div className="adm-insp-form">
          <div className="adm-field">
            <label htmlFor="lesson-title">Título</label>
            <input
              id="lesson-title"
              className="adm-input"
              value={title}
              maxLength={LESSON_TITLE_MAX}
              aria-invalid={touched && titleBad ? true : undefined}
              data-adm-autofocus
              onChange={(event) => setTitle(event.target.value)}
            />
            {touched && titleBad ? <small className="adm-media-err">Informe o título.</small> : null}
          </div>

          <div className="adm-field">
            <label htmlFor="lesson-description">
              Descrição <span>opcional</span>
            </label>
            <textarea id="lesson-description" className="adm-input" rows={4} value={description} maxLength={LESSON_DESCRIPTION_MAX} onChange={(event) => setDescription(event.target.value)} />
          </div>

          <div className="adm-content-grid">
            <div className="adm-field">
              <label htmlFor="lesson-points">Custo em pontos</label>
              <input id="lesson-points" className="adm-input" inputMode="numeric" value={points} aria-invalid={touched && pointsBad ? true : undefined} onChange={(event) => setPoints(event.target.value.replace(/\D/g, ""))} />
              <small>{pointsBad && touched ? `Use um número de 0 a ${LESSON_POINTS_MAX.toLocaleString("pt-BR")}.` : "0 = aula livre."}</small>
            </div>
            <div className="adm-field">
              <label htmlFor="lesson-duration">
                Duração <span>opcional</span>
              </label>
              <input id="lesson-duration" className="adm-input" placeholder="3:25" value={duration} aria-invalid={touched && durationParsed === undefined ? true : undefined} onChange={(event) => setDuration(event.target.value)} />
              <small>{touched && durationParsed === undefined ? "Use minutos:segundos, como 3:25." : "Minutos:segundos."}</small>
            </div>
            <div className="adm-field">
              <label htmlFor="lesson-category">
                Categoria <span>opcional</span>
              </label>
              <input id="lesson-category" className="adm-input" value={category} maxLength={LESSON_CATEGORY_MAX} onChange={(event) => setCategory(event.target.value)} />
            </div>
            <div className="adm-field">
              <label htmlFor="lesson-instructor">
                Instrutor <span>opcional</span>
              </label>
              <input id="lesson-instructor" className="adm-input" inputMode="numeric" placeholder="Id do usuário" value={instructor} onChange={(event) => setInstructor(event.target.value.trim())} />
              <small>Vazio = aula da plataforma.</small>
            </div>
          </div>
        </div>
      </div>
    </AdminDialog>
  );
}
