import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import type { Niche } from "@/shared/types";
import "@/styles/settings-redesign.css";
import "@/styles/settings.css";

import { NichePicker } from "./niche-picker";
import { Field, SettingsSection } from "./settings-section";

const DESC_MAX = 200;
/** A descrição da agência aparece no convite que o criador recebe: texto puro, até 400. */
export const AGENCY_DESC_MAX = 400;
export const WEBSITE_MAX = 300;

/** Site da agência: vazio vale (apaga); preenchido, só `https://…` sem espaços. */
export function websiteError(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (value.length > WEBSITE_MAX) return `No máximo ${WEBSITE_MAX} caracteres.`;
  return /^https:\/\/[^\s]+$/i.test(value) ? null : "O site deve começar com https://";
}

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome da marca").max(120),
  description: z.string().max(2000).optional(),
  niche_id: z.string().optional(),
  website: z.string().optional(),
});

export type BrandValues = z.infer<typeof schema>;

interface Props {
  name: string;
  description: string;
  nicheId: string;
  /** Só agência: site que o criador vê no convite. */
  website?: string;
  /** Agência: descrição de até 400 caracteres e o campo do site. Marca: nada disso aparece. */
  isAgency?: boolean;
  photo?: string | null;
  niches: Niche[];
  canEdit: boolean;
  canPhoto: boolean;
  saving: boolean;
  photoPending: boolean;
  /** O último salvamento deu certo (vale enquanto não houver nova edição). */
  saved?: boolean;
  /** Mensagem do último salvamento que falhou. */
  saveError?: string | null;
  onSave: (v: BrandValues) => void;
  onPhoto: (f: File) => void;
}

/** Aba Marca: identidade (logo, nome, descrição), nicho e a barra de salvamento, com a prévia ao lado. */
export function BrandTab({
  name,
  description,
  nicheId,
  website = "",
  isAgency = false,
  photo,
  niches,
  canEdit,
  canPhoto,
  saving,
  photoPending,
  saved = false,
  saveError = null,
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
    defaultValues: { name, description, niche_id: nicheId, website },
  });

  useEffect(() => {
    reset({ name, description, niche_id: nicheId, website });
  }, [name, description, nicheId, website, reset]);

  const live = watch();
  const niche = live.niche_id ?? "";
  const nicheName = niches.find((n) => String(n.id) === niche)?.name;
  const photoUrl = photo ? getUploadUrl(photo) : undefined;

  const [photoBroken, setPhotoBroken] = useState(false);
  useEffect(() => setPhotoBroken(false), [photoUrl]);
  const showPhoto = !!photoUrl && !photoBroken;
  const [previewOpen, setPreviewOpen] = useState(false);
  const pick = () => fileRef.current?.click();
  const discard = () => reset({ name, description, niche_id: nicheId, website });
  const descMax = isAgency ? AGENCY_DESC_MAX : DESC_MAX;
  const siteError = isAgency ? websiteError(live.website) : null;

  // Alterações não salvas: o navegador avisa antes de fechar ou recarregar a página.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const shownName = (live.name ?? "").trim() || name || "Sua marca";
  const shownDesc = (live.description ?? "").trim();

  return (
    <form className="st-form" onSubmit={handleSubmit(onSave)} noValidate>
      <div className="st-card">
      <SettingsSection id="st-id" title="Identidade" description="Como os criadores veem a marca.">
        <div className="st-id">
          <div className="st-logo">
            <div className="st-logo-i">
              {showPhoto ? <img src={photoUrl} alt="Logo da marca" onError={() => setPhotoBroken(true)} /> : <span aria-hidden="true">{(name || "?").slice(0, 1).toUpperCase()}</span>}
            </div>
            {canPhoto && (
              <button type="button" className="st-link" disabled={photoPending} onClick={pick}>
                {photoPending ? "Enviando…" : showPhoto ? "Trocar logo" : "Enviar logo"}
              </button>
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
          </div>
          <div className="st-fields">
            <Field label="Nome da marca" htmlFor="wkn" error={errors.name?.message}>
              <input className="st-in" id="wkn" placeholder="Ex.: Casa Lume" autoComplete="off" disabled={!canEdit} {...register("name")} />
            </Field>
            <Field label="Descrição" htmlFor="wkd" optional aside={`${(live.description ?? "").length}/${descMax}`}>
              <textarea
                className="st-in"
                id="wkd"
                rows={3}
                maxLength={descMax}
                placeholder={isAgency ? "Conte em poucas linhas o que a agência faz" : "Conte em poucas linhas o que a marca faz"}
                disabled={!canEdit}
                {...register("description")}
              />
            </Field>
            {isAgency ? (
              <Field label="Site" htmlFor="wkw" optional error={siteError ?? undefined}>
                <input className="st-in" id="wkw" type="url" inputMode="url" placeholder="https://suaagencia.com.br" autoComplete="off" maxLength={WEBSITE_MAX} disabled={!canEdit} aria-invalid={siteError ? true : undefined} {...register("website")} />
              </Field>
            ) : null}
          </div>
        </div>
        <p className="st-note">{canPhoto ? "Logo quadrada, JPG ou PNG, de preferência 1000 × 1000 px." : "Apenas administradores podem alterar o logo."}</p>
        {isAgency ? <p className="st-note">A descrição (texto puro) e o site aparecem para o criador no convite do elenco.</p> : null}

        <div className="st-prevwrap">
          <button type="button" className="st-link" aria-expanded={previewOpen} onClick={() => setPreviewOpen((v) => !v)}>
            {previewOpen ? "Ocultar prévia" : "Ver como os criadores veem"}
            <I n="chevdown" cls="sm" />
          </button>
          {previewOpen && (
            <div className="st-prev" aria-label="Prévia para os criadores">
              <div className="st-prev-l">{showPhoto ? <img src={photoUrl} alt="" /> : <span>{shownName.slice(0, 1).toUpperCase()}</span>}</div>
              <div>
                <b>{shownName}</b>
                {nicheName && <span className="st-prev-n">{nicheName}</span>}
                <p className={shownDesc ? "" : "mute"}>{shownDesc || "A descrição da marca aparece aqui."}</p>
                <small>Prévia aproximada: o app dos criadores pode mostrar menos texto.</small>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      {niches.length > 0 && (
        <SettingsSection id="st-nc" title="Nicho de atuação" description="Ajuda a encontrar criadores e campanhas parecidas.">
          <Field label="Nicho principal" htmlFor="wkniche">
            <NichePicker niches={niches} value={niche} disabled={!canEdit} onChange={(id) => setValue("niche_id", id, { shouldDirty: true })} />
          </Field>
        </SettingsSection>
      )}
      </div>

      {!canEdit && <p className="st-note">Somente administradores podem editar nome, descrição e nicho.</p>}

      {canEdit && (
        <div className={`stg-bar${isDirty || saving || saveError || saved ? " show" : ""}${saveError ? " err" : ""}`} role="status" aria-live="polite">
          <span className="stg-bs">
            {saving ? (
              "Salvando…"
            ) : saveError ? (
              <>
                <I n="alert" cls="sm" />
                Não foi possível salvar: {saveError}
              </>
            ) : isDirty ? (
              <>
                <i className="stg-dot" aria-hidden="true" />
                Alterações não salvas
              </>
            ) : saved ? (
              <>
                <I n="check" cls="sm" />
                Alterações salvas
              </>
            ) : null}
          </span>
          {isDirty && (
            <button type="button" className="btn out" disabled={saving} onClick={discard}>
              Descartar
            </button>
          )}
          <button type="submit" className="btn" disabled={!isDirty || saving || !!siteError}>
            <I n="check" cls="sm" />
            {saving ? "Salvando…" : saveError ? "Tentar de novo" : "Salvar alterações"}
          </button>
        </div>
      )}
    </form>
  );
}
