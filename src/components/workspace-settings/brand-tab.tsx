import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import type { Niche } from "@/shared/types";

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome da marca").max(120),
  description: z.string().max(2000).optional(),
  niche_id: z.string().optional(),
});

export type BrandValues = z.infer<typeof schema>;

interface Props {
  name: string;
  description: string;
  nicheId: string;
  photo?: string | null;
  niches: Niche[];
  canEdit: boolean;
  canPhoto: boolean;
  saving: boolean;
  photoPending: boolean;
  onSave: (v: BrandValues) => void;
  onPhoto: (f: File) => void;
}

export function BrandTab({
  name,
  description,
  nicheId,
  photo,
  niches,
  canEdit,
  canPhoto,
  saving,
  photoPending,
  onSave,
  onPhoto,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<BrandValues>({
    resolver: zodResolver(schema),
    defaultValues: { name, description, niche_id: nicheId },
  });

  useEffect(() => {
    reset({ name, description, niche_id: nicheId });
  }, [name, description, nicheId, reset]);

  const niche = watch("niche_id") ?? "";
  const photoUrl = photo ? getUploadUrl(photo) : undefined;

  const [photoBroken, setPhotoBroken] = useState(false);
  useEffect(() => setPhotoBroken(false), [photoUrl]);

  const pick = () => fileRef.current?.click();

  return (
    <form className="wkx-cd" onSubmit={handleSubmit(onSave)} noValidate>
      <div className="wkx-h">
        <div>
          <h3>Marca</h3>
          <p>Como a sua marca aparece para os criadores.</p>
        </div>
      </div>
      <div className="wkx-br">
        <div className="lvf-cvc wkx-lg">
          <label className="n4l">Logo</label>
          {photoUrl && !photoBroken ? (
            <div className="lvf-cv">
              <img src={photoUrl} alt="" onError={() => setPhotoBroken(true)} />
              {canPhoto && (
                <div className="lvf-cva">
                  <button type="button" className="nbtn" disabled={photoPending} onClick={pick}>
                    <I n="image" cls="sm" />
                    {photoPending ? "Enviando…" : "Trocar"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="wkx-lv">
              <div className="lvx-im sq wkx-ph">{(name || "?").slice(0, 1).toUpperCase()}</div>
              {canPhoto && (
                <button type="button" className="wkx-ch" disabled={photoPending} onClick={pick}>
                  <I n="image" cls="sm" />
                  {photoPending ? "Enviando…" : "Trocar logo"}
                </button>
              )}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onPhoto(f);
            }}
          />
          <small className="wkx-hn">
            {canPhoto ? "Quadrada · 1000 × 1000 px" : "Apenas administradores podem alterar a foto."}
          </small>
        </div>

        <div className="wkx-ff">
          <div className={`n4c wkx-fd ${errors.name ? "bad" : ""}`}>
            <label className="n4l" htmlFor="wkn">
              Nome da marca
            </label>
            <input
              className="cm-in"
              id="wkn"
              placeholder="Ex.: Casa Lume"
              autoComplete="off"
              disabled={!canEdit}
              {...register("name")}
            />
            {errors.name && <small className="nfe">{errors.name.message}</small>}
          </div>
          <div className="n4c">
            <label className="n4l" htmlFor="wkd">
              Descrição
            </label>
            <textarea
              className="cm-ta"
              id="wkd"
              rows={3}
              maxLength={200}
              placeholder="Sobre o workspace…"
              disabled={!canEdit}
              {...register("description")}
            />
          </div>
          {niches.length > 0 && (
            <div className="n4c">
              <label className="n4l">Nicho principal</label>
              <div className="nchips">
                {niches.map((n) => {
                  const id = String(n.id);
                  const on = niche === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`nch ${on ? "on" : ""}`}
                      aria-pressed={on}
                      disabled={!canEdit}
                      onClick={() => setValue("niche_id", on ? "" : id, { shouldDirty: true })}
                    >
                      {on && <I n="check" cls="sm" />}
                      {n.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!canEdit && (
            <p className="wkx-note">Somente administradores podem editar nome, descrição e nicho.</p>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="wkx-ac">
          <button type="submit" className="btn" disabled={!isDirty || saving}>
            <I n="check" cls="sm" />
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      )}
    </form>
  );
}
