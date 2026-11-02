import { useEffect, useRef, useState } from "react";

import { I } from "@/components/prototype/ui";

import "@/styles/admin-financial.css";

type CopyState = "idle" | "copied" | "failed";

const FEEDBACK_MS = 1800;

/** Plano B do `navigator.clipboard` (indisponível fora de HTTPS e em alguns navegadores): `execCommand`. */
function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permissão negada ou contexto inseguro: tenta o plano B
  }
  return legacyCopy(text);
}

interface CopyValueProps {
  /** O texto que vai para a área de transferência (e aparece, em fonte monoespaçada). */
  value: string;
  /** O que está sendo copiado, para leitor de tela ("id da cobrança"). */
  label: string;
}

/**
 * Identificador que se copia com um clique (ids de origem das movimentações, para rastrear). O valor completo
 * fica no `title`; a resposta ("Copiado") é anunciada por uma região `status`, fora do botão.
 */
export function CopyValue({ value, label }: CopyValueProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const ok = await copyToClipboard(value);
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), FEEDBACK_MS);
  };

  return (
    <span className="adm-fin-copy">
      <button type="button" className="adm-fin-copy-btn" title={value} aria-label={`Copiar ${label}`} onClick={copy}>
        <span className="adm-fin-copy-text">{value}</span>
        <I n={state === "copied" ? "check" : "copy"} cls="sm" />
      </button>
      <span className="adm-sr" role="status">
        {state === "copied" ? "Copiado" : state === "failed" ? "Não foi possível copiar" : ""}
      </span>
    </span>
  );
}
