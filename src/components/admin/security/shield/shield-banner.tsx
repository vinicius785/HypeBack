import { useEffect, useState } from "react";

import { AdminLink } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useShield } from "@/hooks/admin/use-admin-shield";

import { formatShieldEnd, shieldRemaining } from "./shield-format";

import "@/styles/admin-security.css";

/**
 * Faixa no topo de TODAS as telas do Admin enquanto a Operação Escudo está ligada: até quando vai e quanto falta. Só o
 * administrador da plataforma a consulta (a API recusa os outros papéis); sem Escudo ligado, não existe.
 */
export function ShieldBanner() {
  const shield = useShield();
  const [now, setNow] = useState(() => Date.now());
  const data = shield.data;
  const active = data?.active === true;

  // Atualiza o "falta" a cada 30 s (o estado em si vem da consulta a cada minuto).
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!active || !data) return null;
  const left = shieldRemaining(data.expires_at, now);
  return (
    <div className="pv adm-shield-banner" role="status" aria-live="polite">
      <I n="shield" cls="sm" />
      <span>
        <b>Operação Escudo ativa</b> até {formatShieldEnd(data.expires_at)}
        {left ? <> · falta {left}</> : null}
      </span>
      <AdminLink to="/admin/security" textLink>
        Ver detalhes
      </AdminLink>
    </div>
  );
}
