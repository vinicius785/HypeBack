import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  AdminAvatar,
  AdminDrawer,
  AdminLink,
  adminToast,
} from "@/components/admin/platform";
import { ChatComposer } from "@/components/chat/composer";
import type { ChatLine } from "@/components/chat/flow";
import { MessageFlow } from "@/components/chat/message-flow";
import { useSmartScroll } from "@/components/chat/use-smart-scroll";
import { ChipPopover } from "@/components/agency-projects/board/task-menus";
import { I } from "@/components/prototype/ui";
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
  type SupportTicketDetail,
} from "@/shared/services/admin-support";

import "@/styles/agency-projects.css";

import { workspaceDetailLink } from "../users/admin-users-links";
import { fmtDateTime, ticketNumber, timeAgo } from "./support-format";
import { ContestationPanel } from "./contestation-panel";

const BODY_MAX = 5000;

interface DrawerProps {
  ticketId: string | null;
  canManage: boolean;
  onClose: () => void;
}

/** Detalhe de um pedido: dados de quem pediu, status/prioridade/responsável, a conversa e o campo de resposta ou nota interna. */
export function SupportTicketDrawer({
  ticketId,
  canManage,
  onClose,
}: DrawerProps) {
  const query = useAdminSupportTicket(ticketId);
  const t = query.data;
  return (
    <AdminDrawer
      open={!!ticketId}
      onClose={onClose}
      title={
        t ? `${ticketNumber(t.number)} · ${t.subject}` : "Pedido de suporte"
      }
      description={
        t
          ? `${SUPPORT_SOURCE_LABEL[t.source]} · aberto ${timeAgo(t.created_at)}`
          : undefined
      }
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

function TicketBody({
  ticket: t,
  canManage,
}: {
  ticket: SupportTicketDetail;
  canManage: boolean;
}) {
  const closed = t.status === "closed";
  return (
    <div className="adm-sup-detail">
      <RequesterHeader ticket={t} />

      <TicketDetails ticket={t} canManage={canManage} />

      {t.category === "contestation" && t.requester.user_id !== null ? (
        <ContestationPanel userId={t.requester.user_id} />
      ) : null}

      <SupportChat ticket={t} canManage={canManage} closed={closed} />
    </div>
  );
}

/** Cabeçalho: foto, nome, contato e o sistema do aparelho (modelo e versão do app em fonte de código). */
function RequesterHeader({ ticket: t }: { ticket: SupportTicketDetail }) {
  const photo =
    t.messages.find((m) => m.author_type === "requester" && m.author.avatar)
      ?.author.avatar ?? null;
  const contact = [t.requester.email, t.requester.phone].filter(Boolean);
  const { platform, device, app_version: app } = t.context ?? {};
  const hasSystem = !!(platform || device || app);
  return (
    <header className="adm-sup-req" aria-label="Solicitante">
      <AdminAvatar name={t.requester.name} photo={photo} size={56} />
      <div className="adm-sup-req-id">
        <b>{t.requester.name}</b>
        {contact.length > 0 ? (
          <span className="adm-sup-req-contact">
            {contact.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </span>
        ) : null}
        {hasSystem ? (
          <span className="adm-sup-req-sys" title="Sistema do aparelho">
            <I n="phone" cls="sm" />
            {platform ? <span>{platform}</span> : null}
            {device ? <code>{device}</code> : null}
            {app ? <code>app {app}</code> : null}
          </span>
        ) : null}
        {t.workspace ? (
          <span className="adm-sup-req-ws">
            <I n="grid" cls="sm" />
            <AdminLink to={workspaceDetailLink(t.workspace.id)} textLink>
              {t.workspace.name}
            </AdminLink>
          </span>
        ) : null}
      </div>
    </header>
  );
}

/** Detalhes do chamado: número e assunto e quando abriu; abaixo, as propriedades (status, prioridade, categoria, responsável) como nas tarefas da plataforma. */
function TicketDetails({
  ticket: t,
  canManage,
}: {
  ticket: SupportTicketDetail;
  canManage: boolean;
}) {
  return (
    <section className="adm-sup-info" aria-label="Detalhes do chamado">
      <div className="adm-sup-info-top">
        <div className="adm-sup-info-cell adm-sup-info-ticket">
          <span>Ticket</span>
          <b>
            {ticketNumber(t.number)} · {t.subject}
          </b>
        </div>
        <div className="adm-sup-info-cell">
          <span>Aberto em</span>
          <b>{fmtDateTime(t.created_at)}</b>
          {t.resolved_at ? (
            <small>Resolvido em {fmtDateTime(t.resolved_at)}</small>
          ) : null}
        </div>
      </div>
      <Properties ticket={t} canManage={canManage} />
    </section>
  );
}

function Option({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      className="apj-mi"
      onClick={onClick}
    >
      {children}
      {checked ? <I n="check" cls="sm apj-mi-ok" /> : null}
    </button>
  );
}

/**
 * Propriedades do pedido em chips que abrem um menu pequeno (o mesmo componente das tarefas da plataforma): status,
 * prioridade, categoria e responsável, mais "Assumir". Sem permissão de gerenciar, os chips só mostram o valor.
 */
function Properties({
  ticket: t,
  canManage,
}: {
  ticket: SupportTicketDetail;
  canManage: boolean;
}) {
  const { user } = useAuth();
  const team = useAdminPlatformTeam();
  const update = useAdminUpdateSupportTicket(t.id);
  const people = (team.data?.members ?? []).filter((m) => m.role !== "viewer");
  const assigneeInList =
    !t.assignee || people.some((p) => p.user_id === t.assignee?.id);
  const readOnly = !canManage;

  const apply = (patch: SupportPatch) =>
    update.mutate(patch, {
      onError: (e) => adminToast.error(describeAdminError(e)),
    });

  return (
    <div
      className="apj-props adm-sup-props"
      role="group"
      aria-label="Propriedades do pedido"
    >
      <ChipPopover
        label={`Status: ${SUPPORT_STATUS_LABEL[t.status]}`}
        className="apj-chip-sel adm-sup-chip"
        disabled={readOnly}
        content={
          <>
            <span
              className="adm-sup-dot"
              data-s={t.status}
              aria-hidden="true"
            />
            {SUPPORT_STATUS_LABEL[t.status]}
          </>
        }
      >
        {(close) => (
          <div role="menu" aria-label="Status" className="apj-menu">
            {SUPPORT_STATUSES.map((st) => (
              <Option
                key={st}
                checked={st === t.status}
                onClick={() => {
                  close();
                  if (st !== t.status) apply({ status: st });
                }}
              >
                <span className="adm-sup-dot" data-s={st} aria-hidden="true" />
                {SUPPORT_STATUS_LABEL[st]}
              </Option>
            ))}
          </div>
        )}
      </ChipPopover>

      <ChipPopover
        label={`Prioridade: ${SUPPORT_PRIORITY_LABEL[t.priority]}`}
        className="apj-chip-sel adm-sup-chip"
        data={{
          priority:
            t.priority === "urgent"
              ? "urgente"
              : t.priority === "high"
                ? "alta"
                : undefined,
        }}
        disabled={readOnly}
        content={
          <>
            <I n="flag" cls="sm" />
            {SUPPORT_PRIORITY_LABEL[t.priority]}
          </>
        }
      >
        {(close) => (
          <div role="menu" aria-label="Prioridade" className="apj-menu">
            {[...SUPPORT_PRIORITIES].reverse().map((pr) => (
              <Option
                key={pr}
                checked={pr === t.priority}
                onClick={() => {
                  close();
                  if (pr !== t.priority) apply({ priority: pr });
                }}
              >
                {SUPPORT_PRIORITY_LABEL[pr]}
              </Option>
            ))}
          </div>
        )}
      </ChipPopover>

      <ChipPopover
        label={`Categoria: ${SUPPORT_CATEGORY_LABEL[t.category]}`}
        className="apj-chip-sel adm-sup-chip"
        disabled={readOnly}
        content={
          <>
            <I n="tag" cls="sm" />
            {SUPPORT_CATEGORY_LABEL[t.category]}
          </>
        }
      >
        {(close) => (
          <div role="menu" aria-label="Categoria" className="apj-menu">
            {SUPPORT_CATEGORIES.map((c) => (
              <Option
                key={c}
                checked={c === t.category}
                onClick={() => {
                  close();
                  if (c !== t.category) apply({ category: c });
                }}
              >
                {SUPPORT_CATEGORY_LABEL[c]}
              </Option>
            ))}
          </div>
        )}
      </ChipPopover>

      <ChipPopover
        label={`Responsável: ${t.assignee?.name ?? "sem responsável"}`}
        className="apj-chip-sel adm-sup-chip"
        data={{ empty: !t.assignee }}
        disabled={readOnly}
        width={260}
        content={
          t.assignee ? (
            <>
              <AdminAvatar
                name={t.assignee.name}
                photo={t.assignee.avatar}
                size={20}
              />
              {t.assignee.name}
            </>
          ) : (
            <>
              <I n="user" cls="sm" />
              Sem responsável
            </>
          )
        }
      >
        {(close) => (
          <div role="menu" aria-label="Responsável" className="apj-menu">
            <Option
              checked={!t.assignee}
              onClick={() => {
                close();
                if (t.assignee) apply({ assignee_id: null });
              }}
            >
              Sem responsável
            </Option>
            {!assigneeInList && t.assignee ? (
              <Option checked onClick={close}>
                {t.assignee.name}
              </Option>
            ) : null}
            {people.map((p) => (
              <Option
                key={p.user_id}
                checked={p.user_id === t.assignee?.id}
                onClick={() => {
                  close();
                  if (p.user_id !== t.assignee?.id)
                    apply({ assignee_id: p.user_id });
                }}
              >
                {p.name}
                {p.user_id === user?.id ? " (eu)" : ""}
              </Option>
            ))}
          </div>
        )}
      </ChipPopover>

      {canManage && user && t.assignee?.id !== user.id ? (
        <button
          type="button"
          className="apj-chip adm-sup-assume"
          disabled={update.isPending}
          onClick={() => apply({ assignee_id: user.id })}
        >
          <I n="plus" cls="sm" />
          Assumir
        </button>
      ) : null}
    </div>
  );
}

const CLOSED_TEXT =
  "Este pedido está fechado. Reabra pelo status para responder.";

interface Pending {
  localId: string;
  body: string;
  status: "sending" | "failed" | "sent";
  error?: string;
  createdAt: string;
  confirmedId?: string;
}

/**
 * A conversa do pedido com a mesma interface do chat da plataforma (balões agrupados, separador por dia, rolagem que
 * acompanha a última mensagem, campo com Enter para enviar). Sem anexos: o pedido só leva texto.
 */
function SupportChat({
  ticket: t,
  canManage,
  closed,
}: {
  ticket: SupportTicketDetail;
  canManage: boolean;
  closed: boolean;
}) {
  const send = useAdminSendSupportMessage(t.id);
  const [pending, setPending] = useState<Pending[]>([]);
  const reaches = t.requester.user_id !== null;

  // Notas internas antigas não aparecem mais: a conversa é só entre a equipe e quem pediu.
  const messages = t.messages.filter((m) => m.author_type !== "note");

  // A mensagem confirmada entra no histórico: o balão local sai.
  useEffect(() => {
    const ids = new Set(messages.map((m) => m.id));
    setPending((cur) => {
      const next = cur.filter(
        (p) =>
          !(p.status === "sent" && p.confirmedId && ids.has(p.confirmedId)),
      );
      return next.length === cur.length ? cur : next;
    });
  }, [messages]);

  const dispatch = async (item: Pending) => {
    setPending((cur) =>
      cur.map((p) =>
        p.localId === item.localId
          ? { ...p, status: "sending", error: undefined }
          : p,
      ),
    );
    try {
      const sent = await send.mutateAsync({ body: item.body, kind: "reply" });
      setPending((cur) =>
        cur.map((p) =>
          p.localId === item.localId
            ? { ...p, status: "sent", confirmedId: sent?.id }
            : p,
        ),
      );
    } catch (e) {
      const text = describeAdminError(e);
      setPending((cur) =>
        cur.map((p) =>
          p.localId === item.localId
            ? { ...p, status: "failed", error: text }
            : p,
        ),
      );
    }
  };

  const handleSend = ({ body }: { body: string }) => {
    const item: Pending = {
      localId: `p${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      body,
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    setPending((cur) => [...cur, item]);
    void dispatch(item);
  };

  const lines: ChatLine[] = useMemo(() => {
    const out: ChatLine[] = messages.map((m) => ({
      id: m.id,
      mine: m.author_type === "staff",
      senderKey: `${m.author_type}:${m.author.id ?? m.author.name}`,
      senderName: m.author.name,
      senderAvatar: m.author.avatar,
      body: m.body,
      attachments: [],
      createdAt: m.created_at,
    }));
    for (const p of pending) {
      if (
        p.status === "sent" &&
        p.confirmedId &&
        messages.some((m) => m.id === p.confirmedId)
      )
        continue;
      out.push({
        id: p.localId,
        localId: p.localId,
        mine: true,
        senderKey: "staff:me",
        senderName: "Você",
        body: p.body,
        attachments: [],
        createdAt: p.createdAt,
        status:
          p.status === "failed"
            ? "failed"
            : p.status === "sent"
              ? "sent"
              : "sending",
        error: p.error,
      });
    }
    return out;
  }, [messages, pending]);

  const scroll = useSmartScroll({
    count: lines.length,
    lastMine: lines.length > 0 && lines[lines.length - 1].mine,
    ready: true,
  });
  const sending = pending.some((p) => p.status === "sending");

  return (
    <section aria-label="Conversa" className="adm-sup-chat">
      <h4>
        Conversa{" "}
        <span>
          {lines.length === 1 ? "1 mensagem" : `${lines.length} mensagens`}
        </span>
      </h4>
      <div className="adm-sup-chat-box">
        <div
          className="ch-tb cx-tb"
          ref={scroll.ref}
          onScroll={scroll.onScroll}
          role="log"
          aria-label="Mensagens do pedido"
          aria-live="polite"
          aria-relevant="additions"
          tabIndex={0}
        >
          {lines.length === 0 ? (
            <div className="ov-empty big">
              <span>
                <I n="msg" />
              </span>
              <b>Sem mensagens ainda</b>
              <small>
                {canManage
                  ? "Envie a primeira mensagem abaixo."
                  : "Ninguém respondeu este pedido ainda."}
              </small>
            </div>
          ) : (
            <MessageFlow
              lines={lines}
              handlers={{
                onMediaLoad: scroll.onMediaLoad,
                onRetry: (l) => {
                  const item = pending.find((p) => p.localId === l.localId);
                  if (item) void dispatch(item);
                },
                onDiscard: (l) =>
                  setPending((cur) =>
                    cur.filter((p) => p.localId !== l.localId),
                  ),
              }}
            />
          )}
        </div>
        {scroll.missed > 0 ? (
          <button type="button" className="tc-jump" onClick={scroll.jump}>
            <I n="arrdown" cls="sm" />
            {scroll.missed === 1
              ? "1 nova mensagem"
              : `${scroll.missed} novas mensagens`}
          </button>
        ) : null}
        {canManage ? (
          <>
            {!reaches && !closed ? (
              <p className="adm-sup-hint adm-sup-nouser">
                Este pedido não tem conta na plataforma, então a resposta fica
                só registrada aqui.
                {t.requester.email ? (
                  <>
                    {" "}
                    Responda também por e-mail:{" "}
                    <a
                      href={`mailto:${t.requester.email}?subject=${encodeURIComponent(`Re: ${t.subject} (${ticketNumber(t.number)})`)}`}
                    >
                      {t.requester.email}
                    </a>
                    .
                  </>
                ) : null}
              </p>
            ) : null}
            <ChatComposer
              conversationId={t.id}
              blockedReason={closed ? CLOSED_TEXT : null}
              sending={sending}
              maxBody={BODY_MAX}
              placeholder="Escreva a resposta ao solicitante"
              onSend={handleSend}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
