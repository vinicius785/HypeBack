import { useEffect, useRef, useState } from "react";

import { I } from "@/components/prototype/ui";
import { SquareCropModal } from "@/components/square-crop-modal";
import { useAgencyBrands } from "@/hooks/use-agency-brands";
import {
  CAMPAIGN_BANNER_ACCEPT,
  CAMPAIGN_BANNER_LABEL,
  CAMPAIGN_BANNER_SIZE,
  isSquareImage,
  validateCampaignBannerFile,
} from "@/lib/campaign-banner";

import { Dropdown, Field, FieldError, ListBox } from "./fields";
import type { WizardStepProps } from "./types";

const TITLE_MAX = 60;
const DESC_MAX = 600;
const OBJECTIVE_MAX = 1000;

const FILES_ACCEPT = "image/*,.pdf,.doc,.docx";

// ListBox não aceita className: aplica a variante de cor (verde/vermelho) do protótipo no `.nlbox`.
const tint = (cls: string) => (el: HTMLDivElement | null) => {
  el?.querySelector(".nlbox")?.classList.add(cls);
};

function toList(v: string | string[] | undefined | null): string[] {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

/** Imagem já quadrada: só é reduzida (nunca ampliada) para a medida do banner, sem passar pelo recorte. */
function squareToJpeg(img: HTMLImageElement): Promise<Blob | null> {
  const side = Math.min(CAMPAIGN_BANNER_SIZE, img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(img, 0, 0, side, side);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
}

function bannerFileName(file: File): string {
  return `${file.name.replace(/\.[^.]+$/, "") || "banner"}.jpg`;
}

export function StepCampaign({ formData, updateFormData, fieldErrors, tried }: WizardStepProps) {
  const bannerInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  const [bannerErr, setBannerErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  // Arquivo em recorte; o original fica guardado para o botão "Ajustar" reabrir o recorte.
  const [cropFile, setCropFile] = useState<File | null>(null);
  const original = useRef<File | null>(null);

  const todo = toList(formData.whatToDo);
  const nots = toList(formData.whatNotToDo);
  const title = formData.title ?? "";
  const desc = formData.description ?? "";
  const goal = formData.generalObjective ?? "";

  const bad = (key: string, empty: boolean) => fieldErrors.has(key) || (tried && empty);
  const titleBad = bad("title", !title.trim());
  const brandBad = bad("brandId", !formData.brandId);
  // Só em workspace de agência (`brandRequired`); só marcas ativas entram na escolha.
  const { data: allBrands = [], isLoading: brandsLoading } = useAgencyBrands({ enabled: !!formData.brandRequired });
  const brandOptions = allBrands.filter((b) => b.status === "active").map((b) => ({ value: b.id, label: b.name }));
  const brandKey = brandOptions.map((o) => o.value).join(",");
  // Rascunho de outro workspace pode trazer uma marca que não existe aqui: limpa. Com uma só marca ativa, já escolhe.
  useEffect(() => {
    if (!formData.brandRequired || brandsLoading) return;
    const current = formData.brandId ?? "";
    const values = brandKey ? brandKey.split(",") : [];
    if (current && !values.includes(current)) updateFormData("brandId", "");
    else if (!current && values.length === 1) updateFormData("brandId", values[0]);
  }, [formData.brandRequired, formData.brandId, brandsLoading, brandKey, updateFormData]);
  const descBad = bad("description", !desc.trim());
  const todoBad = bad("whatToDo", todo.length === 0);
  const notsBad = bad("whatNotToDo", nots.length === 0);
  const bannerBad = bad("banner", !formData.banner);

  // Rola até o primeiro campo com erro
  useEffect(() => {
    if (!fieldErrors.size) return;
    const order: Array<[string, string]> = [
      ["banner", "wz-banner"],
      ["title", "wz-title"],
      ["description", "wz-description"],
      ["whatToDo", "wz-todo"],
      ["whatNotToDo", "wz-nots"],
    ];
    const first = order.find(([k]) => fieldErrors.has(k));
    document.getElementById(first?.[1] ?? "")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fieldErrors]);

  /* ---------- banner ---------- */
  const applyBanner = (dataUrl: string, file: File) => {
    updateFormData("banner", dataUrl);
    updateFormData("bannerFile", file);
  };

  const onBannerPick = async (files: FileList | readonly File[] | null) => {
    const file = files?.[0];
    if (bannerInput.current) bannerInput.current.value = "";
    if (!file) return;
    const typeError = validateCampaignBannerFile(file);
    if (typeError) {
      setBannerErr(typeError);
      return;
    }
    setBannerErr("");
    try {
      const img = await loadImage(await readAsDataUrl(file));
      original.current = file;
      if (isSquareImage(img.naturalWidth, img.naturalHeight)) {
        const blob = await squareToJpeg(img);
        if (!blob) throw new Error("canvas");
        await confirmCrop(blob, file);
      } else {
        setCropFile(file);
      }
    } catch {
      setBannerErr("Não foi possível abrir essa imagem. Escolha outro arquivo.");
    }
  };

  const closeCrop = () => setCropFile(null);

  // Recorte pronto (JPEG quadrado na medida do banner): vira o banner da campanha.
  const confirmCrop = async (blob: Blob, source: File) => {
    const out = new File([blob], bannerFileName(source), { type: "image/jpeg" });
    applyBanner(await readAsDataUrl(out), out);
    closeCrop();
  };

  const adjust = () => {
    if (original.current) {
      setCropFile(original.current);
    } else {
      // Banner já salvo (sem original em memória): escolher outro arquivo
      bannerInput.current?.click();
    }
  };

  const removeBanner = () => {
    original.current = null;
    updateFormData("banner", "");
    updateFormData("bannerFile", undefined);
    setBannerErr("");
  };

  const hasBanner = !!formData.banner;

  /* Arrastar e soltar: vale no bloco todo (sem banner ou para trocar o atual) e passa pelas mesmas validações do clique. */
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const dropProps = {
    onDragEnter: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragOver(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // sem isto o navegador não aceita o `drop`
      e.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      // Passar por cima de um filho dispara `dragleave` no pai: só sai de verdade quando o ponteiro deixa o bloco.
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragOver(false);
      void onBannerPick(Array.from(e.dataTransfer.files));
    },
  };

  return (
    <>
      <div className="n1top">
        <div id="wz-banner" className={`nf nban ${bannerBad ? "err" : ""} ${dragOver ? "drag" : ""}`.trim()} {...dropProps}>
          <label>Banner da campanha</label>
          <input
            ref={bannerInput}
            type="file"
            accept={CAMPAIGN_BANNER_ACCEPT}
            hidden
            onChange={(e) => void onBannerPick(e.target.files)}
          />
          {hasBanner ? (
            <div className="nbn sq">
              <span className="nbn-i">
                <img
                  src={formData.banner}
                  alt="Banner da campanha"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </span>
              {dragOver ? <div className="nbn-drop">Solte para trocar o banner</div> : null}
              <div className="nbn-b">
                <button type="button" className="nbtn" aria-label="Ajustar" onClick={adjust}>
                  <I n="image" cls="sm" />
                  Ajustar
                </button>
                <button type="button" className="nbtn" aria-label="Remover banner" onClick={removeBanner}>
                  <I n="trash" cls="sm" />
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="ndrop sq" onClick={() => bannerInput.current?.click()}>
              <span>
                <I n="image" />
              </span>
              <b>{dragOver ? "Solte a imagem aqui" : "Enviar banner"}</b>
              <small>
                {dragOver ? null : (
                  <>
                    Clique ou arraste uma imagem
                    <br />
                  </>
                )}
                JPG ou PNG
                <br />
                {CAMPAIGN_BANNER_LABEL}
              </small>
            </button>
          )}
          <FieldError show={bannerBad && !hasBanner}>Envie o banner</FieldError>
          {bannerErr ? <small className="nfe">{bannerErr}</small> : null}
          <small className="nfh">É assim que a campanha aparece no app</small>
        </div>

        <div className="n1f">
          {formData.brandRequired ? (
            <div id="wz-brandId">
              <Field
                label="Marca"
                err={brandBad}
                hint={!brandsLoading && brandOptions.length === 0 ? "Crie uma marca em Marcas antes de criar a campanha." : undefined}
              >
                <Dropdown
                  value={formData.brandId ?? ""}
                  options={brandOptions}
                  onChange={(v) => updateFormData("brandId", v)}
                  placeholder={brandsLoading ? "Carregando marcas…" : "Escolha a marca da campanha"}
                />
              </Field>
              <FieldError show={brandBad}>Escolha a marca da campanha</FieldError>
            </div>
          ) : null}
          <div id="wz-title">
            <Field label="Título da campanha" err={titleBad}>
              <div className="nwrap">
                <input
                  className="ni"
                  maxLength={TITLE_MAX}
                  placeholder="Escolha um nome claro e descritivo"
                  autoComplete="off"
                  value={title}
                  onChange={(e) => updateFormData("title", e.target.value.slice(0, TITLE_MAX))}
                />
                <em className="ncn">
                  {title.length}/{TITLE_MAX}
                </em>
              </div>
            </Field>
            <FieldError show={titleBad}>Informe o título da campanha</FieldError>
          </div>
          <div id="wz-description">
            <Field label="Descrição" err={descBad} hint="Seja claro e conciso para guiar os criadores">
              <div className="nwrap">
                <textarea
                  className="ni ta"
                  rows={5}
                  maxLength={DESC_MAX}
                  placeholder="Conte o que é a campanha e o que os criadores vão mostrar"
                  value={desc}
                  onChange={(e) => updateFormData("description", e.target.value.slice(0, DESC_MAX))}
                />
                <em className="ncn ta">
                  {desc.length}/{DESC_MAX}
                </em>
              </div>
            </Field>
            <FieldError show={descBad}>Informe a descrição</FieldError>
          </div>
        </div>
      </div>

      <Field label="Objetivo geral">
        <textarea
          className="ni ta"
          rows={3}
          maxLength={OBJECTIVE_MAX}
          placeholder="O que você espera alcançar com esta campanha"
          value={goal}
          onChange={(e) => updateFormData("generalObjective", e.target.value.slice(0, OBJECTIVE_MAX))}
        />
      </Field>

      <div className="nsplit">
        <div id="wz-todo" ref={tint("ls-todo")}>
          <ListBox
            title="O que fazer"
            sub="Itens obrigatórios no conteúdo"
            placeholder="Ex.: mostrar o produto em uso"
            items={todo}
            onChange={(next) => updateFormData("whatToDo", next)}
            icon="check"
          />
          <FieldError show={todoBad}>Adicione ao menos um item</FieldError>
        </div>
        <div id="wz-nots" ref={tint("ls-nots")}>
          <ListBox
            title="O que não fazer"
            sub="Para evitar problemas com a marca"
            placeholder="Ex.: não citar concorrentes"
            items={nots}
            onChange={(next) => updateFormData("whatNotToDo", next)}
            icon="x"
          />
          <FieldError show={notsBad}>Adicione ao menos um item</FieldError>
        </div>
      </div>

      <h3 className="nsh">Materiais de apoio</h3>
      <div className="nl">
        <div className="nl-h">
          <b>Arquivos de apoio</b>
          <small>Guia da marca, moodboard e referências (opcional)</small>
        </div>
        <div className="nfiles">
          {formData.brandFiles ? (
            <div className="nfile">
              <span>
                <I n="file" />
              </span>
              <div>
                <b>{formData.brandFiles}</b>
                <small>Anexado</small>
              </div>
              <button type="button" aria-label="Remover" onClick={() => updateFormData("brandFiles", "")}>
                <I n="x" cls="sm" />
              </button>
            </div>
          ) : null}
        </div>
        <input
          ref={filesInput}
          type="file"
          accept={FILES_ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) updateFormData("brandFiles", f.name);
            e.target.value = "";
          }}
        />
        <button type="button" className="nbtn" onClick={() => filesInput.current?.click()}>
          <I n="paperclip" cls="sm" />
          {formData.brandFiles ? "Trocar arquivo" : "Adicionar arquivo"}
        </button>
      </div>

      {cropFile ? (
        <SquareCropModal
          file={cropFile}
          output={CAMPAIGN_BANNER_SIZE}
          shape="square"
          eyebrow="Banner da campanha"
          title="Ajustar banner"
          hint={`Arraste para escolher a área visível. O banner fica em ${CAMPAIGN_BANNER_LABEL}, como aparece no app.`}
          confirmLabel="Confirmar"
          zoomLabel="Zoom do banner"
          onClose={closeCrop}
          onConfirm={(blob) => void confirmCrop(blob, cropFile)}
        />
      ) : null}
    </>
  );
}
