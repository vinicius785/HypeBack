/**
 * Peças compartilhadas de Admin › Grupos no padrão do protótipo (`gpx-*`):
 * capa, card, casca do diálogo e campos do formulário.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import { validateGroupCoverFile } from "@/shared/services/groups";

import "@/styles/prototype-admin-groups.css";

export const NAME_MAX = 80;
export const DESC_MAX = 280;
export const RULES_MAX = 2000;

const nfmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

/** Rótulo do requisito de entrada (nível e HP são combináveis). */
export function entryLabel(level: number | null, hype: number | null): string {
  const parts: string[] = [];
  if (level != null) parts.push(`Nível ${level}+`);
  if (hype != null && hype > 0) parts.push(`${nfmt(hype)} HP`);
  return parts.length ? parts.join(" · ") : "Aberto";
}

export interface PvGroupCardData {
  name: string;
  description: string;
  /** URL já resolvida (ou blob de pré-visualização). */
  cover: string | null;
  official: boolean;
  level: number | null;
  hype: number | null;
  members: number;
  posts?: number;
  archived: boolean;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** Capa quadrada (`lvx-im`); sem capa, gradiente com as iniciais. */
export function GroupImg({
  src,
  name,
  cls = "",
}: {
  src: string | null;
  name: string;
  cls?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <div className={`lvx-im ${cls}`}>
      {src && !broken ? (
        <img
          className="lvx-up gpx-cvi"
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          className="lvx-s"
          style={{
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(135deg,#ff6a3d,#c2185b)",
            color: "#fff",
            fontWeight: 700,
            fontSize: cls === "sm" ? 24 : 54,
            letterSpacing: "-.04em",
            width: "100%",
            height: "100%",
          }}
        >
          {initialsOf(name)}
        </div>
      )}
    </div>
  );
}

/** `gpCard` do protótipo. `prev` = pré-visualização (sem clique). */
export function GroupCardPv({
  g,
  k,
  prev,
  onOpen,
}: {
  g: PvGroupCardData;
  k: number;
  prev?: boolean;
  onOpen?: () => void;
}) {
  const open = g.level == null && !(g.hype != null && g.hype > 0);
  return (
    <div
      className={`gpx-c ${prev ? "prev" : ""}`}
      style={{ ["--k" as string]: k }}
      {...(prev
        ? {}
        : {
            role: "button",
            tabIndex: 0,
            onClick: onOpen,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter") onOpen?.();
            },
          })}
    >
      <div className="gpx-im">
        <GroupImg src={g.cover} name={g.name || "Grupo"} cls="sq" />
        <div className="gpx-bd">
          {g.official && (
            <span className="gpx-of">
              <I n="verified" cls="sm" />
              Oficial
            </span>
          )}
        </div>
        <span className={`gpx-en ${open ? "open" : "level"}`}>
          <I n={open ? "check" : "lock"} cls="sm" />
          {entryLabel(g.level, g.hype)}
        </span>
      </div>
      <div className="gpx-bo">
        <h3>{g.name || "Nome do grupo"}</h3>
        <p>{g.description || "A descrição do grupo aparece aqui."}</p>
        <div className="gpx-ft">
          <span>
            <I n="users" cls="sm" />
            {nfmt(g.members)}
          </span>
          {typeof g.posts === "number" && (
            <span>
              <I n="file" cls="sm" />
              {nfmt(g.posts)}
            </span>
          )}
          {g.archived && <em>Arquivado</em>}
        </div>
      </div>
    </div>
  );
}

/** Backdrop + `ovw` do protótipo, em portal. */
export function PvOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="pv">
      <div className="ovb on" onClick={onClose} />
      <div className="ovw">{children}</div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Estado do formulário
// ---------------------------------------------------------------------------

export interface GroupFormValues {
  name: string;
  description: string;
  rules: string;
  levelOn: boolean;
  level: string;
  hypeOn: boolean;
  hype: string;
  official: boolean;
}

export interface GroupPayloadFields {
  name: string;
  description: string;
  is_official: boolean;
  rules: string | null;
  required_level: number | null;
  required_hype_points: number | null;
}

export interface GroupFormInitial {
  name?: string;
  description?: string;
  rules?: string | null;
  required_level?: number | null;
  required_hype_points?: number | null;
  is_official?: boolean;
  cover?: string | null;
}

export function useGroupForm(initial?: GroupFormInitial) {
  const [v, setV] = useState<GroupFormValues>(() => ({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    rules: initial?.rules ?? "",
    levelOn: initial?.required_level != null,
    level: initial?.required_level != null ? String(initial.required_level) : "3",
    hypeOn:
      initial?.required_hype_points != null && initial.required_hype_points > 0,
    hype: initial?.required_hype_points
      ? String(initial.required_hype_points)
      : "500",
    official: initial?.is_official ?? false,
  }));
  const [tried, setTried] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial?.cover ?? null);

  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL(coverFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const set = (patch: Partial<GroupFormValues>) =>
    setV((p) => ({ ...p, ...patch }));

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!v.name.trim()) e.name = "Informe o nome";
    else if (v.name.length > NAME_MAX) e.name = `Máx ${NAME_MAX} caracteres`;
    if (!v.description.trim()) e.description = "Escreva uma descrição";
    else if (v.description.length > DESC_MAX)
      e.description = `Máx ${DESC_MAX} caracteres`;
    if (v.rules.length > RULES_MAX) e.rules = `Máx ${RULES_MAX} caracteres`;
    if (v.levelOn) {
      const n = Number.parseInt(v.level, 10);
      if (!v.level || Number.isNaN(n) || n < 1) e.level = "O valor mínimo é 1";
    }
    if (v.hypeOn) {
      const n = Number.parseInt(v.hype, 10);
      if (!v.hype || Number.isNaN(n) || n < 1) e.hype = "O valor mínimo é 1";
    }
    return e;
  }, [v]);

  const pickCover = (file: File | undefined) => {
    if (!file) return;
    const err = validateGroupCoverFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setCoverFile(file);
  };

  const removeCover = () => {
    setCoverFile(null);
    setPreview(initial?.cover ?? null);
  };

  const payload = (): GroupPayloadFields => ({
    name: v.name.trim(),
    description: v.description.trim(),
    is_official: v.official,
    rules: v.rules.trim() || null,
    required_level: v.levelOn ? Number.parseInt(v.level, 10) : null,
    required_hype_points: v.hypeOn ? Number.parseInt(v.hype, 10) : null,
  });

  return {
    v,
    set,
    errors,
    tried,
    setTried,
    coverFile,
    preview,
    pickCover,
    removeCover,
    payload,
  };
}

export type GroupFormApi = ReturnType<typeof useGroupForm>;

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

export function CoverPicker({ f, label }: { f: GroupFormApi; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="lvf-cvc">
      <label className="n4l">{label}</label>
      {f.preview ? (
        <div className="lvf-cv">
          <img src={f.preview} alt="Pré-visualização da capa" />
          <div className="lvf-cva">
            <button
              type="button"
              className="nbtn"
              onClick={() => ref.current?.click()}
            >
              <I n="image" cls="sm" />
              Trocar
            </button>
            {f.coverFile ? (
              <button
                type="button"
                className="nbtn"
                onClick={f.removeCover}
                aria-label="Remover"
              >
                <I n="trash" cls="sm" />
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="lvf-dz"
          onClick={() => ref.current?.click()}
        >
          <span>
            <I n="image" />
          </span>
          <b>Enviar capa</b>
          <small>JPEG, PNG ou WebP · até 5 MB</small>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          f.pickCover(file);
        }}
      />
    </div>
  );
}

export function NameDescRules({
  f,
  className,
  rows = { d: 3, r: 2 },
}: {
  f: GroupFormApi;
  className?: string;
  rows?: { d: number; r: number };
}) {
  const { v, set, errors, tried } = f;
  return (
    <div className={className}>
      <div className={`n4c ${tried && errors.name ? "bad" : ""}`}>
        <label className="n4l">Nome do grupo</label>
        <input
          className="cm-in"
          maxLength={NAME_MAX + 1}
          placeholder="Ex.: Criadores de Games"
          value={v.name}
          onChange={(e) => set({ name: e.target.value })}
          autoComplete="off"
        />
        {tried && errors.name ? <small className="nfe">{errors.name}</small> : null}
      </div>
      <div className={`n4c ${tried && errors.description ? "bad" : ""}`}>
        <label className="n4l">Descrição</label>
        <textarea
          className="cm-ta"
          rows={rows.d}
          maxLength={DESC_MAX + 1}
          placeholder="Sobre o que é esse grupo."
          value={v.description}
          onChange={(e) => set({ description: e.target.value })}
        />
        {tried && errors.description ? (
          <small className="nfe">{errors.description}</small>
        ) : null}
        <small className="gpx-ct">
          {v.description.length}/{DESC_MAX}
        </small>
      </div>
      <div className={`n4c ${tried && errors.rules ? "bad" : ""}`}>
        <label className="n4l">
          Regras <em>opcional</em>
        </label>
        <textarea
          className="cm-ta"
          rows={rows.r}
          maxLength={RULES_MAX + 1}
          placeholder="Regras de convivência exibidas no grupo."
          value={v.rules}
          onChange={(e) => set({ rules: e.target.value })}
        />
        {tried && errors.rules ? <small className="nfe">{errors.rules}</small> : null}
      </div>
    </div>
  );
}

/**
 * "Quem pode entrar". Nível e HypePoints são combináveis no backend, então os
 * dois botões alternam de forma independente; "Todos" limpa ambos.
 */
export function AccessPicker({
  f,
  variant,
}: {
  f: GroupFormApi;
  variant: "tm" | "opt";
}) {
  const { v, set, errors, tried } = f;
  const open = !v.levelOn && !v.hypeOn;
  const bad = tried && (errors.level || errors.hype);
  const opts: [string, string, string, boolean, () => void][] = [
    [
      "Todos os criadores",
      "Qualquer criador entra sem pedir",
      "Todos",
      open,
      () => set({ levelOn: false, hypeOn: false }),
    ],
    [
      "Por nível",
      "Só a partir de um nível mínimo",
      "Por nível",
      v.levelOn,
      () => set({ levelOn: !v.levelOn }),
    ],
    [
      "Por HypePoints",
      "Só quem tiver um saldo mínimo (debitado ao entrar)",
      "Por HypePoints",
      v.hypeOn,
      () => set({ hypeOn: !v.hypeOn }),
    ],
  ];
  return (
    <div className={`n4c ${bad ? "bad" : ""}`}>
      <label className="n4l">Quem pode entrar</label>
      {variant === "tm" ? (
        <div className="n4tm gpx-en3">
          {opts.map(([, , short, on, fn]) => (
            <button key={short} type="button" className={on ? "on" : ""} onClick={fn}>
              {short}
            </button>
          ))}
        </div>
      ) : (
        <div className="gpx-opt">
          {opts.map(([l, h, , on, fn]) => (
            <button key={l} type="button" className={on ? "on" : ""} onClick={fn}>
              <b>{l}</b>
              <small>{h}</small>
            </button>
          ))}
        </div>
      )}
      {v.levelOn && (
        <>
          <div className="gpx-ev">
            <span>Nível mínimo</span>
            <input
              className="cm-in"
              inputMode="numeric"
              value={v.level}
              aria-label="Nível mínimo"
              onChange={(e) => set({ level: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          {tried && errors.level ? <small className="nfe">{errors.level}</small> : null}
        </>
      )}
      {v.hypeOn && (
        <>
          <div className="gpx-ev">
            <span>HypePoints mínimos</span>
            <input
              className="cm-in"
              inputMode="numeric"
              value={v.hype}
              aria-label="HypePoints mínimos"
              onChange={(e) => set({ hype: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          {tried && errors.hype ? <small className="nfe">{errors.hype}</small> : null}
        </>
      )}
    </div>
  );
}

export function OfficialSwitch({
  f,
  className,
}: {
  f: GroupFormApi;
  className?: string;
}) {
  return (
    <div className={`lvf-sw ${className ?? ""}`}>
      <div>
        <b>Selo “Oficial”</b>
        <small>Destaca o grupo como oficial no app</small>
      </div>
      <button
        type="button"
        className={`tgl ${f.v.official ? "on" : ""}`}
        role="switch"
        aria-checked={f.v.official}
        aria-label="Selo Oficial"
        onClick={() => f.set({ official: !f.v.official })}
      >
        <i />
      </button>
    </div>
  );
}
