import { useCallback, useEffect, useRef, useState } from "react";

import { I } from "@/components/prototype/ui";

const CHECK_EVERY_MS = 5 * 60 * 1000;
/** Se a página continuar viva depois deste tempo, a recarga não aconteceu. */
const RELOAD_TIMEOUT_MS = 10_000;

type Phase = "idle" | "updating" | "error";

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
  // Versão publicada no servidor (só guardada quando difere da que está rodando).
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  // Versão cujo aviso foi dispensado: uma versão ainda mais nova volta a avisar.
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorText, setErrorText] = useState("");
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    const server = await fetchServerVersion();
    if (server && server !== __APP_VERSION__) setServerVersion(server);
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

  useEffect(
    () => () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    },
    [],
  );

  const update = () => {
    if (phase === "updating") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setErrorText("Sem conexão com a internet. Conecte-se e tente de novo.");
      setPhase("error");
      return;
    }
    setPhase("updating");
    // A atualização é uma recarga da página: se ela acontecer, este timer morre junto.
    reloadTimer.current = setTimeout(() => {
      setErrorText("Não foi possível recarregar a página. Tente de novo.");
      setPhase("error");
    }, RELOAD_TIMEOUT_MS);
    window.location.reload();
  };

  if (!serverVersion || serverVersion === dismissedVersion) return null;

  const updating = phase === "updating";
  const failed = phase === "error";

  return (
    <div className="pv">
      <div
        className={`upd${failed ? " err" : ""}`}
        role={failed ? "alert" : "status"}
        aria-live={failed ? "assertive" : "polite"}
      >
        <span className="upd-i" aria-hidden="true">
          <I n={failed ? "alert" : "refresh"} />
        </span>
        <div className="upd-t">
          <b>Nova versão disponível</b>
          <small>
            {failed
              ? errorText
              : updating
                ? "Atualizando… a página será recarregada."
                : "Atualize para usar as melhorias mais recentes."}
          </small>
        </div>
        <div className="upd-a">
          <button type="button" className="upd-go" onClick={update} disabled={updating} aria-busy={updating}>
            {updating && <I n="refresh" cls="sm spin" />}
            {updating ? "Atualizando…" : failed ? "Tentar de novo" : "Atualizar"}
          </button>
          <button
            type="button"
            className="upd-x"
            onClick={() => setDismissedVersion(serverVersion)}
            aria-label="Dispensar aviso de nova versão"
          >
            <I n="x" cls="sm" />
          </button>
        </div>
      </div>
    </div>
  );
}
