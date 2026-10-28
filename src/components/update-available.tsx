import { useCallback, useEffect, useState } from "react";

import { I } from "@/components/prototype/ui";

const CHECK_EVERY_MS = 5 * 60 * 1000;

async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    // Dev server (sem version.json), offline ou resposta que não é JSON.
    return null;
  }
}

/** Aviso fixo no canto inferior direito quando há uma versão nova do app publicada. */
export function UpdateAvailable() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    const server = await fetchServerVersion();
    if (server && server !== __APP_VERSION__) setHasUpdate(true);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    void check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  if (!hasUpdate || dismissed) return null;

  return (
    <div className="pv">
      <div className="upd" role="status" aria-live="polite">
        <span className="upd-i">
          <I n="send" />
        </span>
        <div className="upd-t">
          <b>Nova versão disponível</b>
          <small>Atualize para usar as melhorias mais recentes.</small>
        </div>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Atualizar
        </button>
        <button type="button" className="round upd-x" onClick={() => setDismissed(true)} aria-label="Dispensar">
          <I n="x" cls="sm" />
        </button>
      </div>
    </div>
  );
}
