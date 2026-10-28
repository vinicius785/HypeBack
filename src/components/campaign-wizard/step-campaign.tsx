import { useEffect, useRef, useState } from "react";

import { I } from "@/components/prototype/ui";

import { Field, FieldError, ListBox } from "./fields";
import type { WizardStepProps } from "./types";

const TITLE_MAX = 60;
const DESC_MAX = 600;
const OBJECTIVE_MAX = 1000;

// Regra real do banner (mesma do formulário antigo): JPG/PNG, saída 1280 × 512 px.
const BANNER_W = 1280;
const BANNER_H = 512;
const BANNER_ACCEPT = "image/jpeg,image/jpg,image/png";
const BANNER_TYPES = ["image/jpeg", "image/jpg", "image/png"];
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

export function StepCampaign({ formData, updateFormData, fieldErrors, tried }: WizardStepProps) {
  const bannerInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const cropBox = useRef<HTMLDivElement>(null);
  const cropImg = useRef<HTMLImageElement>(null);

  const [bannerErr, setBannerErr] = useState("");
  // Imagem original em recorte (data URL) + arquivo de origem
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [pos, setPos] = useState(0);
  const drag = useRef<{ y: number; p: number } | null>(null);
  // Original guardado para o botão "Ajustar" reabrir o recorte
  const original = useRef<{ src: string; file: File } | null>(null);

  const todo = toList(formData.whatToDo);
  const nots = toList(formData.whatNotToDo);
  const title = formData.title ?? "";
  const desc = formData.description ?? "";
  const goal = formData.generalObjective ?? "";

  const bad = (key: string, empty: boolean) => fieldErrors.has(key) || (tried && empty);
  const titleBad = bad("title", !title.trim());
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

  const onBannerPick = (files: FileList | null) => {
    const file = files?.[0];
    if (bannerInput.current) bannerInput.current.value = "";
    if (!file) return;
    if (!BANNER_TYPES.includes(file.type)) {
      setBannerErr("Use uma imagem JPG ou PNG");
      return;
    }
    setBannerErr("");
    const reader = new FileReader();
    reader.onloadend = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        original.current = { src, file };
        if (img.height > BANNER_H) {
          setCropSrc(src);
          setCropFile(file);
          setPos(0);
        } else {
          applyBanner(src, file);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const closeCrop = () => {
    setCropSrc(null);
    setCropFile(null);
  };

  const clampPos = (p: number) => {
    const box = cropBox.current;
    const img = cropImg.current;
    if (!box || !img || !img.naturalWidth) return Math.min(0, p);
    const shown = img.naturalHeight * (box.clientWidth / img.naturalWidth);
    return Math.max(box.clientHeight - shown, Math.min(0, p));
  };

  const confirmCrop = () => {
    const img = cropImg.current;
    const box = cropBox.current;
    if (!img || !box || !cropSrc) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = BANNER_W;
    canvas.height = BANNER_H;
    const scale = box.clientWidth / img.naturalWidth;
    const top = Math.max(0, -pos / scale);
    const visibleH = Math.min(img.naturalHeight - top, box.clientHeight / scale);
    const ratio = BANNER_W / BANNER_H;
    let sx = 0;
    let sw = img.naturalWidth;
    if (img.naturalWidth / img.naturalHeight > ratio) {
      sw = img.naturalHeight * ratio;
      sx = (img.naturalWidth - sw) / 2;
    }
    let sh = visibleH;
    if (sh < BANNER_H / scale) sh = Math.min(img.naturalHeight - top, BANNER_H / scale);
    ctx.drawImage(img, sx, top, sw, sh, 0, 0, BANNER_W, BANNER_H);
    const name = cropFile?.name || "banner.jpg";
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const out = new File([blob], name, { type: blob.type || "image/jpeg" });
        applyBanner(canvas.toDataURL("image/jpeg", 0.9), out);
        closeCrop();
      },
      "image/jpeg",
      0.9,
    );
  };

  const adjust = () => {
    if (original.current && original.current.src) {
      setCropSrc(original.current.src);
      setCropFile(original.current.file);
      setPos(0);
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

  return (
    <>
      <div className="n1top">
        <div id="wz-banner" className={`nf nban ${bannerBad ? "err" : ""}`.trim()}>
          <label>Banner da campanha</label>
          <input
            ref={bannerInput}
            type="file"
            accept={BANNER_ACCEPT}
            hidden
            onChange={(e) => onBannerPick(e.target.files)}
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
              <b>Enviar banner</b>
              <small>
                JPG ou PNG
                <br />
                {BANNER_W} × {BANNER_H} px
              </small>
            </button>
          )}
          <FieldError show={bannerBad && !hasBanner}>Envie o banner</FieldError>
          {bannerErr ? <small className="nfe">{bannerErr}</small> : null}
          <small className="nfh">É assim que a campanha aparece no app</small>
        </div>

        <div className="n1f">
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

      {cropSrc ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(5,5,5,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 26,
              padding: 22,
              width: "min(680px, 100%)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div className="nl-h">
              <b>Ajustar banner</b>
              <small>Arraste a imagem para escolher a área visível ({BANNER_W} × {BANNER_H} px)</small>
            </div>
            <div
              ref={cropBox}
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: `${BANNER_W} / ${BANNER_H}`,
                overflow: "hidden",
                borderRadius: 18,
                background: "var(--bg)",
                cursor: "grab",
                touchAction: "none",
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { y: e.clientY, p: pos };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                setPos(clampPos(drag.current.p + e.clientY - drag.current.y));
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <img
                ref={cropImg}
                src={cropSrc}
                alt="Banner original"
                draggable={false}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "100%",
                  transform: `translateY(${pos}px)`,
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="nbtn" onClick={closeCrop}>
                Cancelar
              </button>
              <button
                type="button"
                className="nbtn"
                style={{ background: "var(--ink)", color: "#fff" }}
                onClick={confirmCrop}
              >
                <I n="check" cls="sm" />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
