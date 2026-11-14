import type { ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import {
  isAdminActionAlert,
  isAttackAnonymizerWaveAlert,
  isAttackCodeGuessingAlert,
  isAttackEnumerationAlert,
  isAttackIpDeniedAlert,
  isAttackUserProbingAlert,
  isAttackVolumeAlert,
  isSignupDomainClusterAlert,
  isSignupWaveAlert,
  isStaffResetAttemptAlert,
  isWatchedBehaviorAlert,
  isWatchedActiveAlert,
  isWatchedLoginAlert,
  type SecurityAlert,
} from "@/shared/admin-platform.types";

import { actorRoleLabel, behaviorCountText, behaviorSignalLabel, ipDeniedSummary, plural, probingSummary, signupWaveSummary, targetTypeLabel } from "./security-labels";

/** Uma linha do detalhe expandido. `mono`: IP, rota, domínio, e-mail mascarado; `wide`: ocupa a linha inteira. */
export interface AlertDetailRow {
  label: string;
  value: ReactNode;
  mono?: boolean;
  wide?: boolean;
  /** Texto longo digitado por uma pessoa: mantém as quebras de linha. */
  pre?: boolean;
}

/** Etiqueta pequena sob o resumo ("Equipe", "Vigiado", "Conta nova…"). */
export interface AlertChip {
  text: string;
  tone: "warn" | "bad" | "muted";
}

/**
 * Tudo o que muda por tipo de alerta, em um lugar só: o ícone da etiqueta, quem aparece no cabeçalho, o resumo, as etiquetas e o
 * detalhe expandido. `watched_login` e tipo desconhecido não entram aqui (usam o cabeçalho padrão: a conta e o canal).
 * Tudo que vem da rede ou de gente (IP, rota, domínio, e-mail mascarado, motivo) é entregue como texto: o React escapa.
 */
export interface AlertView {
  tagIcon: string;
  /** Ícone no lugar da foto, para os alertas que não têm conta (IP, ondas, domínio). */
  icon?: string;
  /** Cabeçalho de pessoa: "Conta suspeita: Fulano". `fallback` é o que vale quando não há conta. */
  person?: { label: string; fallback: string; fallbackMono?: boolean };
  /** Cabeçalho próprio, para os alertas sem pessoa. */
  head?: { primary: string; secondary: string; mono?: boolean };
  summary?: ReactNode;
  chips?: AlertChip[];
  details?: AlertDetailRow[];
  /** Sempre em vermelho enquanto não visto (conta da equipe visada). */
  critical?: boolean;
  /** Rotas mais chamadas (alerta de comportamento): rota e quantidade, no máximo 5 linhas, em fonte pequena, direto no cartão. */
  routes?: Array<{ route: string; hits: number }>;
  /** Atalho do cartão (cadastros do domínio). */
  action?: { label: string; to: string; search: Record<string, string> };
}

const mono = (text: string | number | null | undefined) => <code className="adm-sec-mono">{text === null || text === undefined || text === "" ? "—" : text}</code>;

function list(items: readonly string[]): ReactNode {
  if (items.length === 0) return "—";
  return (
    <ul className="adm-sec-plain-list">
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

/** Aparelho e IP de onde a conta vigiada entrou, para a linha de resumo: "iPhone/iPad (iOS) · IP 203.0.113.7". */
function accessParts(device: string | null | undefined, ip: string | null | undefined): ReactNode {
  return (
    <>
      {device ? ` · ${device}` : null}
      {ip ? (
        <>
          {" · IP "}
          {mono(ip)}
        </>
      ) : null}
    </>
  );
}

/** Descritor do alerta, ou `null` para o que usa só o cabeçalho padrão (tipo desconhecido). */
export function describeAlert(alert: SecurityAlert): AlertView | null {
  if (isWatchedLoginAlert(alert) || isWatchedActiveAlert(alert)) {
    const d = alert.details;
    const active = isWatchedActiveAlert(alert);
    const firstPath = active ? (alert.details as { first_path?: string | null }).first_path : null;
    const details: AlertDetailRow[] = [
      ...(firstPath ? [{ label: "Primeira rota vista no minuto", value: firstPath, mono: true, wide: true, pre: true }] : []),
      ...(d?.ip ? [{ label: "IP", value: d.ip, mono: true }] : []),
      ...(d?.device ? [{ label: "Aparelho", value: d.device }] : []),
      ...(d?.user_agent ? [{ label: "User-Agent", value: d.user_agent, mono: true, wide: true, pre: true }] : []),
    ];
    const hasAccess = Boolean(d?.device || d?.ip);
    return {
      tagIcon: "eye",
      summary: active ? (
        <>
          Conta vigiada está ativa
          {accessParts(d?.device, d?.ip)}
        </>
      ) : hasAccess ? (
        <>
          {d?.device ?? "Aparelho não identificado"}
          {d?.ip ? (
            <>
              {" · IP "}
              {mono(d.ip)}
            </>
          ) : null}
        </>
      ) : undefined,
      chips: d?.new_ip === true ? [{ text: "IP novo", tone: "bad" }] : [],
      details: details.length > 0 ? details : undefined,
    };
  }

  if (isWatchedBehaviorAlert(alert)) {
    const d = alert.details;
    const label = d ? behaviorSignalLabel(d.signal) : null;
    // Sinal que esta versão não conhece: só o título, sem resumo nem rotas.
    if (!d || !label) return { tagIcon: "eye", person: { label: "Conta vigiada:", fallback: "não identificada" } };
    const count = behaviorCountText(d.signal, d.count, d.window_minutes);
    const routes = (d.top_routes ?? []).filter((r) => typeof r?.route === "string").slice(0, 5);
    return {
      tagIcon: "eye",
      person: { label: "Conta vigiada:", fallback: "não identificada" },
      summary: count ? `${label} · ${count}` : label,
      routes: routes.length > 0 ? routes : undefined,
      details: [
        { label: "O que fez", value: label },
        ...(count ? [{ label: "Quantas vezes", value: count }] : []),
        { label: "Janela", value: `${d.window_minutes} min` },
      ],
    };
  }

  if (isAdminActionAlert(alert)) {
    const d = alert.details;
    const target = [d?.target_label?.trim(), d?.target_type ? targetTypeLabel(d.target_type) : ""].filter(Boolean);
    return {
      tagIcon: "gear",
      person: { label: "Feito por", fallback: "autor não identificado" },
      details: [
        ...(d?.action_label ? [{ label: "Ação", value: d.action_label }] : []),
        { label: "Motivo informado", value: d?.reason || "—", wide: true, pre: true },
        { label: "Alvo", value: target.length === 2 ? `${target[0]} · ${target[1]}` : (target[0] ?? "—") },
        { label: "Feito por", value: d?.actor_role ? actorRoleLabel(d.actor_role) : "—" },
        ...(d?.ip ? [{ label: "IP", value: d.ip, mono: true }] : []),
      ],
    };
  }

  if (isAttackIpDeniedAlert(alert)) {
    const d = alert.details;
    return {
      tagIcon: "ban",
      icon: "ban",
      head: { primary: d?.ip || "IP não informado", secondary: "Tentativas negadas na API", mono: true },
      summary: (
        <>
          {ipDeniedSummary(d?.count ?? 0, d?.window_minutes ?? 0)} {mono(d?.ip)}
        </>
      ),
      details: [
        { label: "IP", value: d?.ip || "—", mono: true },
        { label: "Última rota tentada", value: d?.last_path || "—", mono: true, wide: true, pre: true },
        { label: "Último status", value: d?.last_status ?? "—", mono: true },
      ],
    };
  }

  if (isAttackUserProbingAlert(alert)) {
    const d = alert.details;
    return {
      tagIcon: "alert",
      person: { label: "Conta suspeita:", fallback: "não identificada" },
      summary: probingSummary(d?.count ?? 0, d?.window_minutes ?? 0),
      details: [
        { label: "IP", value: d?.ip || "—", mono: true },
        { label: "Última rota tentada", value: d?.last_path || "—", mono: true, wide: true, pre: true },
        { label: "Último status", value: d?.last_status ?? "—", mono: true },
      ],
    };
  }

  if (isSignupWaveAlert(alert)) {
    return {
      tagIcon: "users",
      icon: "users",
      head: { primary: "Cadastros acima do normal", secondary: "Possível criação de contas em massa" },
      summary: signupWaveSummary(alert.details?.count ?? 0, alert.details?.window_minutes ?? 0),
    };
  }

  if (isAttackCodeGuessingAlert(alert)) {
    const d = alert.details;
    const ips = d?.distinct_ips ?? 0;
    return {
      tagIcon: "lock",
      person: { label: "Conta alvo:", fallback: d?.target || "não identificada", fallbackMono: Boolean(d?.target) },
      summary: (
        <>
          {d?.count ?? 0} {plural(d?.count ?? 0, "código errado", "códigos errados")} em {d?.window_minutes ?? 0} min para {mono(d?.target)}, {plural(ips, "vindo", "vindos")} de {ips}{" "}
          {plural(ips, "IP", "IPs")}
        </>
      ),
      chips: ips >= 5 ? [{ text: "IPs diferentes: possível rede Tor", tone: "warn" }] : [],
      details: [
        { label: "Alvo (e-mail mascarado)", value: d?.target || "—", mono: true },
        { label: "Códigos errados", value: d?.count ?? "—" },
        { label: "IPs diferentes", value: d?.distinct_ips ?? "—" },
        { label: "Última rota tentada", value: d?.last_path || "—", mono: true, wide: true, pre: true },
        { label: "Último status", value: d?.last_status ?? "—", mono: true },
      ],
    };
  }

  if (isAttackVolumeAlert(alert)) {
    const d = alert.details;
    return {
      tagIcon: "trend",
      person: { label: "Conta suspeita:", fallback: "não identificada" },
      summary: `${d?.count ?? 0} ${plural(d?.count ?? 0, "chamada", "chamadas")} em ${d?.window_minutes ?? 0} min`,
      chips: d?.new_account ? [{ text: "Conta nova (menos de 48 h)", tone: "warn" }] : [],
      details: [
        { label: "IP", value: d?.ip || "—", mono: true },
        { label: "Conta nova (menos de 48 h)", value: d?.new_account ? "Sim" : "Não" },
        { label: "Última rota", value: d?.last_path || "—", mono: true, wide: true, pre: true },
      ],
    };
  }

  if (isAttackEnumerationAlert(alert)) {
    const d = alert.details;
    return {
      tagIcon: "search",
      person: { label: "Conta suspeita:", fallback: "não identificada" },
      summary: (
        <>
          Leu {d?.distinct_ids ?? 0} {plural(d?.distinct_ids ?? 0, "registro diferente", "registros diferentes")} em {d?.window_minutes ?? 0} min na rota {mono(d?.route)}
        </>
      ),
      details: [
        { label: "IP", value: d?.ip || "—", mono: true },
        { label: "Registros diferentes", value: d?.distinct_ids ?? "—" },
        { label: "Rota", value: d?.route || "—", mono: true, wide: true, pre: true },
      ],
    };
  }

  if (isAttackAnonymizerWaveAlert(alert)) {
    const d = alert.details;
    return {
      tagIcon: "eye",
      icon: "eye",
      head: { primary: "Tor/VPN bloqueados", secondary: "Rede anônima tentando entrar" },
      summary: `${d?.count ?? 0} ${plural(d?.count ?? 0, "tentativa bloqueada", "tentativas bloqueadas")} de rede anônima (Tor/VPN) em ${d?.window_minutes ?? 0} min`,
      details: [
        { label: "Tentativas bloqueadas", value: d?.count ?? "—" },
        { label: "Última rota", value: d?.last_path || "—", mono: true, wide: true, pre: true },
      ],
    };
  }

  if (isStaffResetAttemptAlert(alert)) {
    const d = alert.details;
    const chips: AlertChip[] = [];
    if (d?.staff) chips.push({ text: "Equipe", tone: "bad" });
    if (d?.watched) chips.push({ text: "Vigiado", tone: "warn" });
    return {
      tagIcon: "shield",
      critical: true,
      person: { label: "Conta visada:", fallback: d?.target || "não identificada", fallbackMono: Boolean(d?.target) },
      summary: (
        <>
          {d?.attempts ?? 0} {plural(d?.attempts ?? 0, "tentativa", "tentativas")} de redefinir a senha de {mono(d?.target)}
        </>
      ),
      chips,
      details: [
        { label: "Conta visada (e-mail mascarado)", value: d?.target || "—", mono: true },
        { label: "Tentativas", value: d?.attempts ?? "—" },
        { label: "IPs diferentes", value: d?.distinct_ips ?? "—" },
        { label: "IPs", value: list(d?.ips ?? []), mono: true, wide: true },
        { label: "Rotas", value: list(d?.paths ?? []), mono: true, wide: true },
      ],
    };
  }

  if (isSignupDomainClusterAlert(alert)) {
    const d = alert.details;
    return {
      tagIcon: "users",
      icon: "users",
      head: { primary: d?.domain ? `@${d.domain}` : "Domínio não informado", secondary: "Vários cadastros do mesmo domínio", mono: true },
      summary: (
        <>
          {d?.count ?? 0} {plural(d?.count ?? 0, "conta nova", "contas novas")} do domínio {mono(d?.domain)} em {d?.window_minutes ?? 0} min
        </>
      ),
      details: [
        { label: "Domínio", value: d?.domain || "—", mono: true },
        { label: "Contas novas", value: d?.count ?? "—" },
        { label: "Janela", value: d ? `${d.window_minutes} min` : "—" },
      ],
      action: d?.domain ? { label: "Ver cadastros deste domínio", to: "/admin/users", search: { search: `@${d.domain}` } } : undefined,
    };
  }

  return null;
}

/** Ícone do círculo que substitui a foto. */
export function AlertIcon({ name }: { name: string }) {
  return (
    <span className="adm-sec-attack-ico" aria-hidden="true">
      <I n={name} />
    </span>
  );
}
