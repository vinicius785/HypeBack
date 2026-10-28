import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";

import { Av, I } from "@/components/prototype/ui";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import {
  useCampaignContracts,
  useContractTemplates,
  useDownloadContract,
  useResendContract,
} from "@/hooks/use-campaign-contracts";
import type { CampaignContract, ContractStatus } from "@/shared/types";
import "@/styles/prototype-contracts.css";

import {
  SendContractModal,
  type InfluencerOption,
} from "./contracts/send-contract-modal";
import { TemplatePreviewModal } from "./contracts/template-preview-modal";

interface ContractsTabProps {
  /**
   * Lista do dashboard — mantida para compat com a screen pai e para passar
   * `username` aos componentes. A fonte de verdade da aba é `/contracts`.
   */
  influencers?: InfluencerOption[];
}

type Filter = "all" | "pending" | "wait" | "signed" | "closed";

const FILTERS: Array<[Filter, string]> = [
  ["all", "Todos"],
  ["pending", "Para enviar"],
  ["wait", "Aguardando"],
  ["signed", "Assinados"],
  ["closed", "Encerrados"],
];

const STATUS_BADGE: Record<
  ContractStatus,
  { text: string; bg: string; textColor: string }
> = {
  pending: { text: "Pendente de envio", bg: "bg-neutral-100", textColor: "text-neutral-700" },
  sent: { text: "Enviado", bg: "bg-blue-50", textColor: "text-blue-700" },
  viewed: { text: "Visualizado", bg: "bg-amber-50", textColor: "text-amber-800" },
  signed: { text: "Assinado", bg: "bg-green-50", textColor: "text-green-700" },
  rejected: { text: "Rejeitado", bg: "bg-red-50", textColor: "text-red-700" },
  expired: { text: "Expirado", bg: "bg-orange-50", textColor: "text-orange-700" },
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  pending: "Pendente de envio",
  sent: "Enviado",
  viewed: "Visualizado",
  signed: "Assinado",
  rejected: "Rejeitado",
  expired: "Expirado",
};

const TYPE_LABEL: Record<NonNullable<CampaignContract["contract_type"]>, string> = {
  platform: "Padrão",
  custom: "Upload próprio",
};

const SELECTABLE: ContractStatus[] = ["pending", "sent", "viewed"];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Linha pending = contrato ainda não criado (backend devolve `id: null`). */
function isPendingRow(c: CampaignContract): boolean {
  return c.id === null;
}

function effStatus(c: CampaignContract): ContractStatus {
  return isPendingRow(c) ? "pending" : c.status;
}

function inFilter(c: CampaignContract, f: Filter): boolean {
  const s = effStatus(c);
  if (f === "all") return true;
  if (f === "wait") return s === "sent" || s === "viewed";
  if (f === "closed") return s === "rejected" || s === "expired";
  return s === f;
}

function rowSub(c: CampaignContract): string {
  switch (effStatus(c)) {
    case "pending":
      return "Contrato ainda não enviado";
    case "sent":
      return c.sent_at
        ? `Enviado ${formatDay(c.sent_at)}${c.expiration_at ? ` · expira ${formatDay(c.expiration_at)}` : ""}`
        : "Enviado";
    case "viewed":
      return c.expiration_at
        ? `Visualizado · expira ${formatDay(c.expiration_at)}`
        : "Visualizado";
    case "signed":
      return c.signed_at ? `Assinado em ${formatDay(c.signed_at)}` : "Assinado";
    case "rejected":
      return "Recusado pelo criador";
    case "expired":
      return c.expiration_at
        ? `Expirou em ${formatDay(c.expiration_at)}`
        : "Expirado";
  }
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function ContractsTab({ influencers = [] }: ContractsTabProps) {
  const { campaignId } = useParams({
    from: "/(private)/(app)/campaigns/$campaignId",
  });

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [presetCampaignUserId, setPresetCampaignUserId] = useState<string>("");
  const [detail, setDetail] = useState<CampaignContract | null>(null);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const allRef = useRef<HTMLInputElement>(null);

  const {
    data: contracts = [],
    isLoading,
    refetch,
  } = useCampaignContracts(campaignId || "", {});

  const { mutate: resend, isPending: isResending } = useResendContract(
    campaignId || "",
  );
  const { mutate: download, isPending: isDownloading } = useDownloadContract(
    campaignId || "",
  );
  const { data: templates = [], isLoading: isLoadingTemplates } =
    useContractTemplates();

  const usernameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const inf of influencers) {
      if (inf.user_id && inf.username) {
        map.set(String(inf.user_id), inf.username);
      }
    }
    return map;
  }, [influencers]);

  const usernameOf = (c: CampaignContract) =>
    c.influencer_id != null
      ? usernameByUserId.get(String(c.influencer_id))
      : undefined;

  const sorted = useMemo(
    () =>
      [...contracts].sort((a, b) => {
        const ap = isPendingRow(a) ? 0 : 1;
        const bp = isPendingRow(b) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        const ad = a.sent_at ?? a.created_at ?? "";
        const bd = b.sent_at ?? b.created_at ?? "";
        return bd.localeCompare(ad);
      }),
    [contracts],
  );

  const visibleRows = useMemo(() => {
    const q = norm(query.trim());
    return sorted.filter((c) => {
      if (!inFilter(c, filter)) return false;
      if (!q) return true;
      const u = c.influencer_id != null ? usernameByUserId.get(String(c.influencer_id)) : "";
      return norm(`${c.influencer_name} ${u ?? ""}`).includes(q);
    });
  }, [sorted, filter, query, usernameByUserId]);

  const count = (f: Filter) => contracts.filter((c) => inFilter(c, f)).length;
  const total = contracts.length;
  const signedCount = count("signed");
  const pct = total ? Math.round((signedCount / total) * 100) : 0;

  const selectableIds = visibleRows
    .filter((c) => SELECTABLE.includes(effStatus(c)))
    .map((c) => c.campaign_user_id);
  const nSel = selectableIds.filter((id) => checked.has(id)).length;
  const hasSelectable = selectableIds.length > 0;

  useEffect(() => {
    if (allRef.current) {
      allRef.current.checked = nSel > 0 && nSel === selectableIds.length;
      allRef.current.indeterminate = nSel > 0 && nSel < selectableIds.length;
    }
  });

  const selectedRow =
    contracts.find((c) => c.campaign_user_id === selectedId) ?? null;

  const sendCandidates: InfluencerOption[] = useMemo(() => {
    return contracts.map((c) => ({
      id: c.campaign_user_id,
      name: c.influencer_name,
      avatar: c.influencer_photo ?? "",
      username:
        c.influencer_id != null
          ? usernameByUserId.get(String(c.influencer_id))
          : undefined,
      status: c.kanban_status ?? undefined,
    }));
  }, [contracts, usernameByUserId]);

  const openSendModal = (campaignUserId?: string) => {
    setPresetCampaignUserId(campaignUserId ?? "");
    setSendModalOpen(true);
  };

  const closeSendModal = () => {
    setSendModalOpen(false);
    setPresetCampaignUserId("");
  };

  const handleResend = (contract: CampaignContract) => {
    if (!contract.id) return;
    resend(contract.id, {
      onSuccess: () => {
        toast.success("Contrato reenviado.");
        refetch();
      },
      onError: (e) =>
        toast.error(
          e instanceof Error ? e.message : "Erro ao reenviar contrato.",
        ),
    });
  };

  const handleViewTemplate = () => {
    if (isLoadingTemplates) return;
    if (templates.length === 0) {
      toast.info("Nenhum template padrão cadastrado ainda.");
      return;
    }
    if (templates.length === 1) {
      const url = templates[0]?.content;
      if (!url) {
        toast.error("O template padrão não possui URL disponível.");
        return;
      }
      window.open(url, "_blank", "noopener");
      return;
    }
    setTemplatesModalOpen(true);
  };

  const handleDownload = (contract: CampaignContract) => {
    if (!contract.id) return;
    if (contract.signed_file_url) {
      window.open(contract.signed_file_url, "_blank", "noopener");
      return;
    }
    const filename = `contrato-${contract.influencer_name
      .toLowerCase()
      .replace(/\s+/g, "-")}.pdf`;
    download(
      { contractId: contract.id, filename },
      {
        onError: (e) =>
          toast.error(
            e instanceof Error ? e.message : "Erro ao baixar contrato.",
          ),
      },
    );
  };

  /** Ação primária da linha: Enviar (pending), Baixar (signed) ou Reenviar. */
  const rowAction = (c: CampaignContract) => {
    const s = effStatus(c);
    if (s === "pending") openSendModal(c.campaign_user_id);
    else if (s === "signed") handleDownload(c);
    else handleResend(c);
  };

  const toggleChecked = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleAll = (on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      selectableIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const goFilter = (f: Filter) => {
    setFilter(f);
    setSelectedId(null);
  };

  const bulkSend = () => {
    const first = [...checked][0];
    if (first) openSendModal(first);
    setChecked(new Set());
  };

  const nChecked = checked.size;

  return (
    <>
      <div className="pv">
        <div className="mg">
          <div className="gwrap">
            <div className="gmain card gjm">
              <div className="gjh">
                <div>
                  <h2>Contratos</h2>
                  <p className="sub">Envio, acompanhamento e assinatura</p>
                </div>
                <div className="gjp">
                  <b>
                    {signedCount}
                    <span> de {total} assinados</span>
                  </b>
                  <div className="cc-trk">
                    <i
                      style={
                        { "--w": `${pct}%`, "--i": 0 } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="gtools gjt">
                <div className="gtabs">
                  {FILTERS.map(([k, l]) => (
                    <button
                      key={k}
                      className={filter === k ? "on" : ""}
                      onClick={() => goFilter(k)}
                    >
                      {l}
                      <em>{count(k)}</em>
                    </button>
                  ))}
                </div>
                <div className="ctr-tools">
                  <label className={`find mini ${query ? "has" : ""}`}>
                    <I n="search" cls="sm" />
                    <input
                      placeholder="Buscar"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <button
                    className="round"
                    onClick={handleViewTemplate}
                    aria-label="Ver modelo"
                    title="Ver modelo"
                  >
                    <I n="file" cls="sm" />
                  </button>
                </div>
              </div>
              <div className="gscroll">
                {isLoading ? (
                  <div className="empty">
                    <b>Carregando contratos…</b>
                  </div>
                ) : visibleRows.length === 0 ? (
                  <div className="empty">
                    <span className="ei">
                      <I n="file" />
                    </span>
                    <b>Nenhum contrato</b>
                    <p>
                      {total === 0
                        ? "Quando você enviar contratos, eles aparecerão aqui."
                        : "Nada com este filtro."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={`crh ${hasSelectable ? "" : "nocb"}`}>
                      <span className="crc">
                        {hasSelectable && (
                          <input
                            ref={allRef}
                            type="checkbox"
                            aria-label="Selecionar todos"
                            onChange={(e) => toggleAll(e.target.checked)}
                          />
                        )}
                      </span>
                      <span></span>
                      <span>Influenciador</span>
                      <span>Status</span>
                      <span className="r">Ação</span>
                    </div>
                    <div className={`ctlist gt ${hasSelectable ? "" : "nocb"}`}>
                      {visibleRows.map((r) => {
                        const s = effStatus(r);
                        const can = SELECTABLE.includes(s);
                        const id = r.campaign_user_id;
                        return (
                          <div
                            key={id}
                            className={`cr ctt ${selectedId === id ? "cur" : ""} ${checked.has(id) ? "on" : ""}`}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest("input, button")) return;
                              setSelectedId(selectedId === id ? null : id);
                            }}
                          >
                            <span className="crc">
                              {can && (
                                <input
                                  type="checkbox"
                                  checked={checked.has(id)}
                                  onChange={(e) => toggleChecked(id, e.target.checked)}
                                  aria-label={`Selecionar ${r.influencer_name}`}
                                />
                              )}
                            </span>
                            <Av
                              name={r.influencer_name}
                              src={r.influencer_photo ?? undefined}
                              size={44}
                            />
                            <div className="crm">
                              <b>
                                <span>{r.influencer_name}</span>
                              </b>
                              <small>{rowSub(r)}</small>
                            </div>
                            <span className={`gs c-${s}`}>
                              <i></i>
                              {STATUS_LABEL[s]}
                            </span>
                            <span className="cra">
                              <button
                                className="gact"
                                disabled={(s === "signed" && isDownloading) || (s !== "pending" && s !== "signed" && isResending)}
                                onClick={() => rowAction(r)}
                              >
                                {s === "signed" && <I n="download" cls="sm" />}
                                {s === "pending" ? "Enviar" : s === "signed" ? "Baixar" : "Reenviar"}
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div id="ctbar">
                {nChecked > 0 && (
                  <div className="gbar">
                    <span className="gbc">{nChecked}</span>
                    <b>selecionado{nChecked > 1 ? "s" : ""}</b>
                    <span style={{ flex: 1 }}></span>
                    <button className="lnk" onClick={() => setChecked(new Set())}>
                      Limpar
                    </button>
                    <button className="gbtn" onClick={bulkSend}>
                      <I n="send" cls="sm" />
                      Enviar contratos
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div id="s2h">
            {!selectedRow ? (
              <aside className="side2 fade">
                <div className="s2-top">
                  <small>Resumo dos contratos</small>
                  <div className="s2-p">
                    <b>{signedCount}</b>
                    <span>de {total} assinados</span>
                  </div>
                  <div className="cc-trk">
                    <i
                      style={
                        { "--w": `${pct}%`, "--i": 0 } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
                <section className="s2">
                  <h3>Para agir</h3>
                  <button className="s2r" onClick={() => goFilter("pending")}>
                    <b>{count("pending")}</b>
                    <span>Contratos para enviar</span>
                    <I n="chev" cls="sm" />
                  </button>
                  <button className="s2r" onClick={() => goFilter("wait")}>
                    <b>{count("wait")}</b>
                    <span>Aguardando assinatura</span>
                    <I n="chev" cls="sm" />
                  </button>
                  <button className="s2r" onClick={() => goFilter("closed")}>
                    <b>{count("closed")}</b>
                    <span>Rejeitados ou expirados</span>
                    <I n="chev" cls="sm" />
                  </button>
                </section>
                <section className="s2">
                  <h3>Como funciona</h3>
                  <p className="s2-s" style={{ lineHeight: 1.55 }}>
                    O contrato digital é enviado ao e-mail do criador depois da
                    aprovação. A campanha só avança quando ele assina.
                  </p>
                </section>
              </aside>
            ) : (
              <ContractSide
                row={selectedRow}
                username={usernameOf(selectedRow)}
                onClose={() => setSelectedId(null)}
                onAction={() => rowAction(selectedRow)}
                onView={() => setDetail(selectedRow)}
              />
            )}
          </div>
        </div>
      </div>

      {sendModalOpen && (
        <SendContractModal
          campaignId={campaignId || ""}
          influencers={sendCandidates}
          initialInfluencerId={presetCampaignUserId || undefined}
          onClose={closeSendModal}
          onSuccess={refetch}
        />
      )}

      {templatesModalOpen && (
        <TemplatePreviewModal
          templates={templates}
          onClose={() => setTemplatesModalOpen(false)}
        />
      )}

      {detail && (
        <ContractDetailModal
          contract={detail}
          username={usernameOf(detail)}
          onClose={() => setDetail(null)}
          onResend={() => {
            handleResend(detail);
            setDetail(null);
          }}
          onDownload={() => handleDownload(detail)}
          isResending={isResending}
          isDownloading={isDownloading}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Painel lateral do contrato
// ---------------------------------------------------------------------------

function ContractSide({
  row,
  username,
  onClose,
  onAction,
  onView,
}: {
  row: CampaignContract;
  username?: string;
  onClose: () => void;
  onAction: () => void;
  onView: () => void;
}) {
  const s = effStatus(row);
  const done = s === "signed";
  const seen = s === "viewed" || s === "signed";
  const sent = s !== "pending";
  const tl: Array<[string, string, boolean]> = [
    ["Enviado", sent ? formatDay(row.sent_at) : "—", sent],
    ["Visualizado", seen ? formatDay(row.viewed_at) : "—", seen],
    ["Assinado", done ? formatDay(row.signed_at) : "—", done],
    ["Expira em", formatDay(row.expiration_at), false],
  ];
  const signers: Array<[string, string, boolean]> = [
    ["Influenciador", row.influencer_name, done],
  ];
  if (row.representative_email)
    signers.push(["Representante da marca", row.representative_email, sent]);
  if (row.witness_1_email) signers.push(["Testemunha 1", row.witness_1_email, done]);
  if (row.witness_2_email) signers.push(["Testemunha 2", row.witness_2_email, done]);

  return (
    <aside className="side2 fade">
      <div
        className="s2-nav"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "-4px 0 0 -10px",
        }}
      >
        <button className="lnk" onClick={onClose}>
          <I n="back" cls="sm" />
          Resumo
        </button>
        <span className={`cs ${s}`}>{STATUS_LABEL[s]}</span>
      </div>
      <div className="drw-h" style={{ paddingTop: 0 }}>
        <Av
          name={row.influencer_name}
          src={row.influencer_photo ?? undefined}
          size={60}
        />
        <h2 style={{ fontSize: 21 }}>{row.influencer_name}</h2>
        {username && <p>@{username}</p>}
      </div>
      <section className="s2">
        <h3>Andamento</h3>
        {tl.map(([a, b, ok]) => (
          <div
            key={a}
            className={`hi ${ok ? "cur" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "7px 0",
              fontSize: 13.5,
              color: ok ? undefined : "var(--muted)",
            }}
          >
            <i
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: ok ? "var(--brand)" : "var(--hair)",
              }}
            />
            <span style={{ flex: 1, fontWeight: ok ? 600 : undefined }}>{a}</span>
            <small>{b}</small>
          </div>
        ))}
      </section>
      <section className="s2">
        <h3>Signatários</h3>
        {signers.map(([a, b, ok]) => (
          <div key={a} className="s2d" style={{ gridTemplateColumns: "1fr auto" }}>
            <span style={{ fontWeight: 600 }}>
              {a}
              <small style={{ display: "block", fontWeight: 500 }}>{b}</small>
            </span>
            {ok ? <I n="check" cls="sm" /> : null}
          </div>
        ))}
      </section>
      <div className="drw-b">
        <button className="btn" onClick={onAction}>
          <I n={s === "pending" ? "send" : s === "signed" ? "download" : "refresh"} cls="sm" />
          {s === "pending" ? "Enviar contrato" : s === "signed" ? "Baixar assinado" : "Reenviar"}
        </button>
        {!isPendingRow(row) && (
          <button className="btn out" onClick={onView}>
            Ver contrato
          </button>
        )}
      </div>
    </aside>
  );
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const cfg = STATUS_BADGE[status];
  return (
    <Badge
      text={cfg.text}
      backgroundColor={cfg.bg}
      textColor={cfg.textColor}
    />
  );
}

// ---------------------------------------------------------------------------
// Modal de detalhes
// ---------------------------------------------------------------------------

function ContractDetailModal({
  contract,
  username,
  onClose,
  onResend,
  onDownload,
  isResending,
  isDownloading,
}: {
  contract: CampaignContract;
  username?: string;
  onClose: () => void;
  onResend: () => void;
  onDownload: () => void;
  isResending: boolean;
  isDownloading: boolean;
}) {
  const showDownload = contract.status === "signed";
  const showResend =
    contract.status === "sent" ||
    contract.status === "viewed" ||
    contract.status === "rejected" ||
    contract.status === "expired";

  return (
    <Modal
      title="Detalhes do contrato"
      onClose={onClose}
      panelClassName="max-w-2xl"
    >
      <div className="flex flex-col gap-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-4">
          <Avatar
            src={contract.influencer_photo ?? undefined}
            alt={contract.influencer_name}
            size="lg"
          />
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
              {contract.influencer_name}
            </h3>
            {username && (
              <span className="text-xs text-neutral-500">@{username}</span>
            )}
            <div className="flex items-center gap-2">
              <StatusBadge status={contract.status} />
              {contract.contract_type && (
                <span className="text-xs text-neutral-500">
                  · {TYPE_LABEL[contract.contract_type]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Timeline / dados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-neutral-200 p-4">
          <DetailItem label="Enviado em" value={formatDate(contract.sent_at)} />
          <DetailItem
            label="Visualizado em"
            value={formatDate(contract.viewed_at)}
          />
          <DetailItem
            label="Assinado em"
            value={formatDate(contract.signed_at)}
            highlight={contract.status === "signed"}
          />
          <DetailItem
            label="Expira em"
            value={formatDate(contract.expiration_at)}
          />
        </div>

        {/* Signatários */}
        <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-4">
          <p className="text-sm font-semibold text-neutral-900">Signatários</p>
          <div className="flex flex-col gap-1 text-xs text-neutral-600">
            <SignerLine
              label="Influenciador"
              value="Resolvido pelo cadastro do app"
            />
            <SignerLine
              label="Representante da marca"
              value={contract.representative_email}
            />
            <SignerLine
              label="Testemunha 1"
              value={contract.witness_1_email}
            />
            <SignerLine
              label="Testemunha 2"
              value={contract.witness_2_email}
            />
          </div>
        </div>

        {/* Rejeição */}
        {contract.rejection_reason && (
          <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
            <p className="text-sm font-semibold text-red-700 mb-1">
              Motivo da rejeição
            </p>
            <p className="text-sm text-red-700">{contract.rejection_reason}</p>
          </div>
        )}

        {/* Envelope */}
        {contract.automation_operation_id && (
          <div className="text-xs text-neutral-500">
            Envelope{" "}
            {contract.automation_provider
              ? `(${contract.automation_provider})`
              : ""}
            :{" "}
            <code className="font-mono text-neutral-700">
              {contract.automation_operation_id}
            </code>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-2 border-t border-neutral-100">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {showDownload && (
            <Button onClick={onDownload} disabled={isDownloading}>
              <span className="inline-flex items-center gap-2">
                <Icon name="Download" color="#FAFAFA" size={16} />
                {isDownloading ? "Baixando..." : "Baixar contrato"}
              </span>
            </Button>
          )}
          {showResend && (
            <Button onClick={onResend} disabled={isResending}>
              <span className="inline-flex items-center gap-2">
                <Icon name="Send" color="#FAFAFA" size={16} />
                {isResending ? "Reenviando..." : "Reenviar contrato"}
              </span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DetailItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span
        className={
          highlight
            ? "text-sm font-semibold text-green-700"
            : "text-sm text-neutral-800"
        }
      >
        {value}
      </span>
    </div>
  );
}

function SignerLine({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-800 truncate max-w-[60%]">
        {value || "—"}
      </span>
    </div>
  );
}
