import { useEffect, useRef, useState } from "react";

import { AdminBadge, AdminDrawer, AdminKeyValueList, AdminLink, adminToast } from "@/components/admin/platform";
import { useAuth } from "@/contexts/auth-context";
import {
  useAdminSendSupportMessage,
  useAdminSupportTicket,
  useAdminUpdateSupportTicket,
  type SupportPatch,
} from "@/hooks/admin/use-admin-support";
import { useAdminPlatformTeam } from "@/hooks/admin/use-admin-team";
import { describeAdminError } from "@/lib/admin/admin-errors";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABEL,
  SUPPORT_SOURCE_LABEL,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABEL,
  type SupportCategory,
  type SupportMessage,
  type SupportPriority,
  type SupportStatus,
  type SupportTicketDetail,
} from "@/shared/services/admin-support";

import { workspaceDetailLink } from "../users/admin-users-links";
import { PRIORITY_TONE, SOURCE_TONE, STATUS_TONE, fmtDateTime, ticketNumber, timeAgo } from "./support-format";

const BODY_MAX = 5000;
const AFTER_SEND = [
  { value: "", label: "Manter o status" },
  { value: "waiting", label: "Marcar como aguardando cliente" },
  { value: "resolved", label: "Marcar como resolvido" },
] as const;

interface DrawerProps {
  ticketId: string | null;
  canManage: boolean;
  onClose: () => void;
}

/** Detalhe de um pedido: dados de quem pediu, status/prioridade/responsável, a conversa e o campo de resposta ou nota interna. */
export function SupportTicketDrawer({ ticketId, canManage, onClose }: DrawerProps) {
  const query = useAdminSupportTicket(ticketId);
  const t = query.data;
  return (
    <AdminDrawer
      open={!!ticketId}
      onClose={onClose}
      title={t ? `${ticketNumber(t.number)} · ${t.subject}` : "Pedido de suporte"}
      description={t ? `${SUPPORT_SOURCE_LABEL[t.source]} · aberto ${timeAgo(t.created_at)}` : undefined}
      size="lg"
      footer={
        <button type="button" className="btn out" onClick={onClose}>
          Fechar
        </button>
      }
    >
      {query.isLoading ? (
        <p className="adm-muted">Carregando…</p>
      ) : query.isError || !t ? (
        <p role="alert">{describeAdminError(query.error)}</p>
      ) : (
        <TicketBody key={t.id} ticket={t} canManage={canManage} />
      )}
    </AdminDrawer>
  );
}

function TicketBody({ ticket: t, canManage }: { ticket: SupportTicketDetail; canManage: boolean }) {
  const closed = t.status === "closed";
  return (
    <div className="adm-sup-detail">
      {canManage ? <Controls ticket={t} /> : <ReadOnlyBadges ticket={t} />}

      <AdminKeyValueList
        items={[
          { label: "Solicitante", value: t.requester.name, hint: [t.requester.email, t.requester.phone].filter(Boolean).join(" · ") || undefined },
          ...(t.workspace ? [{ label: "Workspace", value: <AdminLink to={workspaceDetailLink(t.workspace.id)} textLink>{t.workspace.name}</AdminLink> }] : []),
          { label: "Categoria", value: SUPPORT_CATEGORY_LABEL[t.category] },
          ...(t.context?.page_url ? [{ label: "Página", value: t.context.page_url }] : []),
          ...(t.context?.app_version || t.context?.platform || t.context?.device
            ? [{ label: "Aparelho", value: [t.context?.platform, t.context?.device, t.context?.app_version && `app ${t.context.app_version}`].filter(Boolean).join(" · ") }]
            : []),
          { label: "Aberto em", value: fmtDateTime(t.created_at) },
          ...(t.resolved_at ? [{ label: "Resolvido em", value: fmtDateTime(t.resolved_at) }] : []),
        ]}
      />

      <section aria-label="Conversa">
        <h4>Conversa</h4>
        <ol className="adm-sup-thread">
          {t.messages.map((m) => (
            <Message key={m.id} message={m} />
          ))}
        </ol>
      </section>

      {canManage ? <Composer ticket={t} closed={closed} /> : null}
    </div>
  );
}

function ReadOnlyBadges({ ticket: t }: { ticket: SupportTicketDetail }) {
  return (
    <div className="adm-sup-badges">
      <AdminBadge tone={SOURCE_TONE[t.source]}>{SUPPORT_SOURCE_LABEL[t.source]}</AdminBadge>
      <AdminBadge tone={STATUS_TONE[t.status]}>{SUPPORT_STATUS_LABEL[t.status]}</AdminBadge>
      <AdminBadge tone={PRIORITY_TONE[t.priority]}>{SUPPORT_PRIORITY_LABEL[t.priority]}</AdminBadge>
      <span>{t.assignee ? `Responsável: ${t.assignee.name}` : "Sem responsável"}</span>
    </div>
  );
}

function Controls({ ticket: t }: { ticket: SupportTicketDetail }) {
  const { user } = useAuth();
  const team = useAdminPlatformTeam();
  const update = useAdminUpdateSupportTicket(t.id);
  const people = (team.data?.members ?? []).filter((m) => m.role !== "viewer");
  const assigneeInList = !t.assignee || people.some((p) => p.user_id === t.assignee?.id);

  const apply = (patch: SupportPatch) =>
    update.mutate(patch, { onError: (e) => adminToast.error(describeAdminError(e)) });

  return (
    <div className="adm-sup-ctl" role="group" aria-label="Situação do pedido">
      <label>
        <span>Status</span>
        <select value={t.status} disabled={update.isPending} onChange={(e) => apply({ status: e.target.value as SupportStatus })}>
          {SUPPORT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SUPPORT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Prioridade</span>
        <select value={t.priority} disabled={update.isPending} onChange={(e) => apply({ priority: e.target.value as SupportPriority })}>
          {[...SUPPORT_PRIORITIES].reverse().map((p) => (
            <option key={p} value={p}>
              {SUPPORT_PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Categoria</span>
        <select value={t.category} disabled={update.isPending} onChange={(e) => apply({ category: e.target.value as SupportCategory })}>
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SUPPORT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Responsável</span>
        <select
          value={t.assignee?.id ?? ""}
          disabled={update.isPending}
          onChange={(e) => apply({ assignee_id: e.target.value === "" ? null : Number(e.target.value) })}
        >
          <option value="">Sem responsável</option>
          {!assigneeInList && t.assignee ? <option value={t.assignee.id}>{t.assignee.name}</option> : null}
          {people.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.name}
              {p.user_id === user?.id ? " (eu)" : ""}
            </option>
          ))}
        </select>
      </label>
      {user && t.assignee?.id !== user.id ? (
        <button type="button" className="btn out adm-btn-sm" disabled={update.isPending} onClick={() => apply({ assignee_id: user.id })}>
          Assumir
        </button>
      ) : null}
    </div>
  );
}

function Message({ message: m }: { message: SupportMessage }) {
  const who = m.author_type === "requester" ? "Solicitante" : m.author_type === "note" ? "Nota interna" : "Equipe";
  return (
    <li className="adm-sup-msg" data-kind={m.author_type}>
      <header>
        <b>{m.author.name}</b>
        <span className="adm-sup-who">{who}</span>
        <time dateTime={m.created_at} title={fmtDateTime(m.created_at)}>
          {timeAgo(m.created_at)}
        </time>
      </header>
      <p>{m.body}</p>
    </li>
  );
}

function Composer({ ticket: t, closed }: { ticket: SupportTicketDetail; closed: boolean }) {
  const send = useAdminSendSupportMessage(t.id);
  const [kind, setKind] = useState<"reply" | "note">(closed ? "note" : "reply");
  const [body, setBody] = useState("");
  const [after, setAfter] = useState<"" | "waiting" | "resolved">("");
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (closed) setKind("note");
  }, [closed]);

  const reaches = t.requester.user_id !== null;
  const submit = () => {
    const text = body.trim();
    if (!text) {
      setError(kind === "reply" ? "Escreva a resposta." : "Escreva a nota.");
      return;
    }
    setError(null);
    send.mutate(
      { body: text, kind, ...(kind === "reply" && after ? { status: after } : {}) },
      {
        onSuccess: () => {
          setBody("");
          setAfter("");
          adminToast.success(kind === "reply" ? "Resposta enviada." : "Nota salva.");
          area.current?.focus();
        },
        onError: (e) => setError(describeAdminError(e)),
      },
    );
  };

  return (
    <form
      className="adm-sup-composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <div className="adm-sup-seg" role="radiogroup" aria-label="Tipo de mensagem">
        <button type="button" role="radio" aria-checked={kind === "reply"} disabled={closed} onClick={() => setKind("reply")}>
          Responder
        </button>
        <button type="button" role="radio" aria-checked={kind === "note"} onClick={() => setKind("note")}>
          Nota interna
        </button>
      </div>
      {closed ? <p className="adm-sup-hint">Este pedido está fechado: só é possível deixar notas internas. Reabra pelo status para responder.</p> : null}
      {kind === "reply" && !closed && !reaches ? (
        <p className="adm-sup-hint">
          Este pedido não tem conta na plataforma, então a resposta fica só registrada aqui.
          {t.requester.email ? (
            <>
              {" "}
              Responda também por e-mail:{" "}
              <a href={`mailto:${t.requester.email}?subject=${encodeURIComponent(`Re: ${t.subject} (${ticketNumber(t.number)})`)}`}>{t.requester.email}</a>.
            </>
          ) : null}
        </p>
      ) : null}
      {kind === "note" ? <p className="adm-sup-hint">A nota é só da equipe: quem pediu nunca vê.</p> : null}
      <textarea
        ref={area}
        aria-label={kind === "reply" ? "Resposta" : "Nota interna"}
        rows={4}
        maxLength={BODY_MAX}
        placeholder={kind === "reply" ? "Escreva a resposta ao solicitante" : "Escreva uma nota para a equipe"}
        value={body}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setBody(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      {error ? (
        <small className="adm-sup-err" role="alert">
          {error}
        </small>
      ) : null}
      <div className="adm-sup-send">
        {kind === "reply" && !closed ? (
          <select aria-label="Depois de enviar" value={after} onChange={(e) => setAfter(e.target.value as typeof after)}>
            {AFTER_SEND.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <span />
        )}
        <button type="submit" className="btn" disabled={send.isPending}>
          {send.isPending ? "Enviando…" : kind === "reply" ? "Enviar resposta" : "Salvar nota"}
        </button>
      </div>
    </form>
  );
}
