import { useEffect, useRef, useState, type ReactNode } from "react";

import { getInitials } from "@/components/campaign-card";
import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";

import "@/styles/campaign-delete.css";

export interface CampaignHeaderProps {
  title: string;
  description?: string;
  /** Path do banner (medida única 1080 × 1080, 1:1; os antigos em 5:2 aparecem cortados no centro). */
  banner?: string | null;
  /** Status normalizado (draft, published, finished…) e o rótulo da etiqueta. */
  status: string;
  statusLabel: string;
  /** `campaigns_write`: libera publicar, verificar publicações, editar e despublicar. */
  canWrite: boolean;
  checking: boolean;
  /** Há criador na etapa "Publicado": só então "Verificar publicações" aparece. */
  hasPublished: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onCheckPublications: () => void;
  onEdit: () => void;
  onOpenInvite: () => void;
  onShare: () => void;
  /** `campaigns_delete`: mostra "Excluir" (só com `onDelete`). */
  canDelete?: boolean;
  onDelete?: () => void;
  /** Abas da campanha, coladas na base do cartão. */
  children?: ReactNode;
}

/**
 * Cabeçalho da campanha (`.chd`): capa, identificação, abas e ações num cartão branco, sempre
 * do mesmo tamanho (sem recolher nem expandir) e rola junto com a página. A única animação é a entrada, quando a campanha abre. Envolva em `.pv`.
 */
export function CampaignHeader({
  title,
  description,
  banner,
  status,
  statusLabel,
  canWrite,
  checking,
  hasPublished,
  onPublish,
  onUnpublish,
  onCheckPublications,
  onEdit,
  onOpenInvite,
  onShare,
  canDelete = false,
  onDelete,
  children,
}: CampaignHeaderProps) {
  const cover = getUploadUrl(banner);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [cover]);

  // Menu "⋯" (Editar e Excluir): fecha ao clicar fora, com Esc ou ao escolher.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  const hasMenu = canWrite || (canDelete && !!onDelete);

  // Seletor de status: a etiqueta abre um menu com as opções (Rascunho / Publicado); escolher a outra dispara a ação
  // correspondente (publicar ou despublicar). Só para quem pode escrever e só em rascunho/publicada.
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!statusOpen) return;
    const onDown = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStatusOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [statusOpen]);
  const statusChoices: Array<{ id: "draft" | "published"; label: string }> = [
    { id: "draft", label: "Rascunho" },
    { id: "published", label: "Publicado" },
  ];
  const pickStatus = (id: "draft" | "published") => {
    setStatusOpen(false);
    if (id === status) return;
    if (id === "published") onPublish();
    else onUnpublish();
  };

  const draft = status === "draft";
  const tone =
    status === "published" || status === "active"
      ? "p"
      : status === "finished" || status === "completed"
        ? "k"
        : "";

  return (
    <section className="chd chi">
      <div className="chi-h">
        <div className="chd-cover">
          {cover && !broken ? (
            <img src={cover} alt="" onError={() => setBroken(true)} />
          ) : (
            <span className="chd-ph">{getInitials(title) || "?"}</span>
          )}
        </div>
        <div className="chd-main">
          <h1 title={title}>{title}</h1>
          {description ? (
            <p className="chd-desc" title={description}>
              {description}
            </p>
          ) : null}
        </div>
        <div className="chd-act">
          {canWrite && draft && (
            <button type="button" className="btn" onClick={onPublish}>
              <I n="send" cls="sm" />
              Publicar
            </button>
          )}
          {canWrite && hasPublished && (
            <button
              type="button"
              className={draft ? "btn out" : "btn"}
              disabled={checking}
              onClick={onCheckPublications}
            >
              <I n="refresh" cls="sm" />
              {checking ? "Verificando..." : "Verificar publicações"}
            </button>
          )}
          {canWrite && (status === "published" || status === "draft") ? (
            <div className="chd-sel" ref={statusRef}>
              <button
                type="button"
                className={`pill ${tone} chd-st`.trim()}
                aria-haspopup="listbox"
                aria-expanded={statusOpen}
                title="Alterar status da campanha"
                onClick={() => setStatusOpen((v) => !v)}
              >
                {statusLabel}
                <I n="chevdown" cls="sm" />
              </button>
              {statusOpen ? (
                <div className="chd-pop chd-opts" role="listbox" aria-label="Status da campanha">
                  {statusChoices.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="option"
                      aria-selected={o.id === status}
                      className={o.id === status ? "sel" : ""}
                      onClick={() => pickStatus(o.id)}
                    >
                      <span>{o.label}</span>
                      {o.id === status ? <I n="check" cls="sm" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <span className={`pill ${tone} chd-st`.trim()}>{statusLabel}</span>
          )}
          <span className="chd-qs">
            <button type="button" className={canWrite ? "chd-q" : "btn"} onClick={onOpenInvite}>
              <I n="eye" cls="sm" />
              Ver convite
            </button>
            <button type="button" className="chd-q" onClick={onShare}>
              <I n="share" cls="sm" />
              Compartilhar
            </button>
          </span>
        </div>
        {hasMenu ? (
          <div className="chd-menu" ref={menuRef}>
            <button
              type="button"
              className="chd-more"
              aria-label="Mais ações da campanha"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <I n="more" cls="sm" />
            </button>
            {menuOpen ? (
              <div className="chd-pop" role="menu" aria-label="Ações da campanha">
                {canWrite ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                  >
                    <I n="notepad" cls="sm" />
                    Editar
                  </button>
                ) : null}
                {canDelete && onDelete ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="dng"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    <I n="trash" cls="sm" />
                    Excluir
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
