import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { I } from "@/components/prototype/ui";
import { LIVE_STATUS_META } from "@/components/lives/live-status-badge";
import { LiveForm, type LiveFormSubmit } from "@/components/lives/live-form";
import { LiveStudio } from "@/components/lives/live-studio";
import { LiveMetrics } from "@/components/lives/live-metrics";
import { LiveChat } from "@/components/lives/live-chat";
import {
  useCancelLive,
  useEndLive,
  useLive,
  useRemoveLive,
  useRefreshBroadcasterToken,
  useStartLive,
  useUpdateLive,
} from "@/hooks/use-lives";
import { useLiveSocket } from "@/hooks/use-live-socket";
import {
  createLiveIngress,
  getLiveIngress,
  uploadLiveThumbnail,
  type LiveIngressCredentials,
} from "@/shared/services/lives";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import { getUploadUrl } from "@/lib/utils/api";

import "@/styles/prototype-lives-studio.css";
import type { BroadcasterCredentials, LiveComment } from "@/shared/types";

export const Route = createFileRoute("/(private)/(app)/lives/$liveId")({
  component: RouteComponent,
});

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function RouteComponent() {
  const { liveId } = Route.useParams();
  const navigate = useNavigate();
  const permissions = useWorkspacePermissions();
  const canBroadcast = permissions.community_lives_write;

  const { data: live, isLoading, error } = useLive(liveId);

  const startMutation = useStartLive();
  const endMutation = useEndLive();
  const cancelMutation = useCancelLive();
  const removeMutation = useRemoveLive();
  const updateMutation = useUpdateLive(liveId);
  const refreshTokenMutation = useRefreshBroadcasterToken();

  const [broadcaster, setBroadcaster] = useState<BroadcasterCredentials | null>(
    null,
  );
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [views, setViews] = useState(0);
  const [likes, setLikes] = useState(0);
  const [peak, setPeak] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [confirm, setConfirm] = useState<
    "end" | "cancel" | "remove" | null
  >(null);
  const tokenRequestedRef = useRef(false);

  // Destino RTMP externo (OBS/vMix → live) — #41.
  const [ingress, setIngress] = useState<LiveIngressCredentials | null>(null);
  const [ingressLoading, setIngressLoading] = useState(false);

  const isLive = live?.status === "live";
  const isUpcoming = live?.status === "upcoming";

  const handleGenerateIngress = async () => {
    setIngressLoading(true);
    try {
      const creds = await createLiveIngress(liveId);
      setIngress(creds);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível gerar o RTMP.",
      );
    } finally {
      setIngressLoading(false);
    }
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  // Semeia contadores do snapshot do detalhe; o socket sobrepõe em tempo real.
  useEffect(() => {
    if (live) {
      setViews(live.views_count);
      setLikes(live.likes_count);
    }
  }, [live?.views_count, live?.likes_count]);

  // Pico de espectadores observado nesta sessão (card "Pico" do estúdio).
  useEffect(() => {
    if (isLive) setPeak((p) => Math.max(p, views));
  }, [isLive, views]);

  // As credenciais vivem no LiveKit, não no estado do navegador. Recuperá-las
  // permite recarregar/reabrir a tela sem perder servidor e stream key.
  useEffect(() => {
    let active = true;

    if (!canBroadcast || (!isUpcoming && !isLive)) {
      setIngress(null);
      return () => {
        active = false;
      };
    }

    setIngressLoading(true);
    getLiveIngress(liveId)
      .then((credentials) => {
        if (active) setIngress(credentials);
      })
      .catch(() => {
        // Ausência/indisponibilidade na consulta não bloqueia a página; o POST
        // exibirá um erro acionável caso o usuário tente gerar as credenciais.
        if (active) setIngress(null);
      })
      .finally(() => {
        if (active) setIngressLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canBroadcast, isLive, isUpcoming, liveId]);

  // Ao reabrir uma live já no ar (sem credenciais em memória), re-minta o token
  // de publish para reconectar o estúdio.
  useEffect(() => {
    if (!isLive) {
      tokenRequestedRef.current = false;
      return;
    }
    if (!canBroadcast || broadcaster || tokenRequestedRef.current) return;
    tokenRequestedRef.current = true;
    refreshTokenMutation
      .mutateAsync(liveId)
      .then(setBroadcaster)
      .catch((err) => {
        tokenRequestedRef.current = false;
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível obter as credenciais de transmissão.",
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, canBroadcast, broadcaster, liveId]);

  // Realtime: chat + contadores enquanto no ar.
  const liveSocket = useLiveSocket({
    liveId,
    enabled: isLive,
    onComment: (c) =>
      setComments((prev) =>
        prev.some((x) => x.id === c.id) ? prev : [...prev, c],
      ),
    onLikeBurst: (n) => setLikes(n),
    onViewerCount: (n) => setViews(n),
    onError: (message) => toast.error(message),
  });

  const handleStart = async () => {
    try {
      const res = await startMutation.mutateAsync(liveId);
      tokenRequestedRef.current = true;
      setBroadcaster(res.broadcaster);
      toast.success("Você está no ar!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao iniciar.";
      toast.error(
        msg.includes("streaming_unavailable") || msg.toLowerCase().includes("stream")
          ? "Streaming indisponível: configure o provedor (LiveKit) no servidor."
          : msg,
      );
    }
  };

  const handleConfirm = async () => {
    try {
      if (confirm === "end") {
        await endMutation.mutateAsync(liveId);
        setBroadcaster(null);
        toast.success("Live encerrada.");
      } else if (confirm === "cancel") {
        await cancelMutation.mutateAsync(liveId);
        toast.success("Agendamento cancelado.");
      } else if (confirm === "remove") {
        await removeMutation.mutateAsync(liveId);
        toast.success("Live removida do histórico.");
        await navigate({ to: "/lives" });
      }
      setConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na operação.");
    }
  };

  const handleEdit = async (values: LiveFormSubmit, thumbnailFile: File | null) => {
    try {
      let thumbnailUrl = live?.thumbnail_url ?? null;
      if (thumbnailFile) {
        try {
          const uploaded = await uploadLiveThumbnail(thumbnailFile);
          thumbnailUrl = uploaded.url;
        } catch {
          toast.warning("Não foi possível enviar a nova thumbnail.");
        }
      }
      await updateMutation.mutateAsync({
        title: values.title,
        description: values.description,
        host_display_name: values.host_display_name,
        thumbnail_url: thumbnailUrl,
        scheduled_at: values.scheduled_at,
      });
      toast.success("Live atualizada.");
      setShowEdit(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    }
  };

  const handleTokenExpired = () => {
    refreshTokenMutation
      .mutateAsync(liveId)
      .then(setBroadcaster)
      .catch(() => toast.error("Sessão de transmissão expirou. Recarregue a página."));
  };

  // ---------------------------------------------------------------- estados

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !live) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Icon name="TriangleAlert" size={28} color="#dc2626" />
        <p className="text-lg font-semibold text-neutral-950">
          Live não encontrada
        </p>
        <span className="text-sm text-neutral-600">
          {error instanceof Error ? error.message : "Ela pode ter sido removida."}
        </span>
        <Link to="/lives" className="text-sm font-semibold text-primary-600">
          Voltar para Lives
        </Link>
      </div>
    );
  }

  const isEnded = live.status === "ended";
  const isCancelled = live.status === "cancelled";
  const thumb = getUploadUrl(live.thumbnail_url ?? undefined);
  const vodUrl = getUploadUrl(live.recording_url ?? undefined);
  const timeLabel = formatDateTime(
    isUpcoming ? live.scheduled_at : isLive ? live.started_at : live.ended_at,
  );

  const statusMeta = LIVE_STATUS_META[live.status];
  const stateText = timeLabel
    ? isUpcoming
      ? `Agendada para ${timeLabel}`
      : isLive
        ? `No ar desde ${timeLabel}`
        : `Encerrada em ${timeLabel}`
    : null;
  const stageMsg = isUpcoming
    ? "Aguardando início da transmissão"
    : isCancelled
      ? "Live cancelada"
      : live.recording_status === "processing"
        ? "Processando gravação..."
        : live.recording_status === "failed"
          ? "A gravação não pôde ser processada"
          : "Transmissão encerrada";
  const showVod = isEnded && !!vodUrl && live.recording_status === "ready";
  const confirmPending =
    endMutation.isPending || cancelMutation.isPending || removeMutation.isPending;

  return (
    <>
      <div className="pv">
        <div className="wrap" style={{ maxWidth: "none" }}>
          <Link
            to="/lives"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--muted)",
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            <I n="back" cls="sm" />
            Voltar para Lives
          </Link>

          <div className="head fade lvhd">
            <div>
              <div className="lvs-hd-t">
                <h1>{live.title}</h1>
                <span className={`pill${isLive ? " k" : ""}`}>
                  {isLive && <i className="lvx-dot" style={{ margin: 0 }} />}
                  {statusMeta.label}
                </span>
              </div>
              {stateText && <p className="lvs-hd-meta">{stateText}</p>}
            </div>

            {canBroadcast && (
              <div className="btns" style={{ flexWrap: "wrap" }}>
                {isUpcoming && (
                  <>
                    <button type="button" className="btn out" onClick={() => setShowEdit(true)}>
                      Editar
                    </button>
                    <button type="button" className="btn out" onClick={() => setConfirm("cancel")}>
                      Cancelar
                    </button>
                  </>
                )}
                {(isUpcoming || isLive) && (
                  <button
                    type="button"
                    className="btn out"
                    onClick={handleGenerateIngress}
                    disabled={ingressLoading}
                  >
                    {ingressLoading
                      ? "Carregando RTMP..."
                      : ingress
                        ? "Ver credenciais RTMP"
                        : "Configurar OBS (RTMP)"}
                  </button>
                )}
                {isUpcoming && (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleStart}
                    disabled={startMutation.isPending}
                  >
                    <i className="lvx-rec" style={{ margin: 0 }} />
                    {startMutation.isPending ? "Iniciando..." : "Ir ao vivo"}
                  </button>
                )}
                {isLive && !broadcaster && (
                  <button type="button" className="btn dng2" onClick={() => setConfirm("end")}>
                    Encerrar live
                  </button>
                )}
                {!isLive && (
                  <button
                    type="button"
                    className="btn out"
                    style={{ color: "var(--danger)" }}
                    onClick={() => setConfirm("remove")}
                  >
                    <I n="trash" cls="sm" />
                    Remover
                  </button>
                )}
              </div>
            )}
          </div>

          <section className="lvs-page" aria-label="Estúdio">
            {/* Vídeo: estúdio (ao vivo) / gravação / estado estático */}
            {isLive && broadcaster ? (
              <LiveStudio
                credentials={broadcaster}
                onTokenExpired={handleTokenExpired}
                onError={(m) => toast.error(m)}
                views={views}
                likes={likes}
                startedAt={live.started_at}
                onEnd={canBroadcast ? () => setConfirm("end") : undefined}
              />
            ) : (
              <div className="lvs-l">
                <div className="lvs-fr">
                  <div className={`lvs-v${showVod ? " vod" : ""}`}>
                    {showVod ? (
                      <video
                        key={vodUrl}
                        controls
                        playsInline
                        poster={thumb}
                        src={vodUrl}
                      />
                    ) : thumb ? (
                      <img src={thumb} alt={live.title} style={{ opacity: 0.6 }} />
                    ) : null}
                  </div>
                  {!showVod && (
                    <div className="lvs-ov">
                      {isLive ? (
                        <>
                          <div className="lvs-sp" />
                          <span>Preparando estúdio de transmissão...</span>
                        </>
                      ) : (
                        <>
                          <I
                            n={isUpcoming ? "clock" : isCancelled ? "ban" : "video"}
                          />
                          <span>{stageMsg}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Painel lateral: título, métricas, RTMP, chat */}
            <div className="lvs-r">
              <div className="lvs-h">
                <div>
                  <small>
                    {isLive ? "Estúdio" : "Sala de controle"} · {statusMeta.label}
                    {live.host_display_name ? ` · ${live.host_display_name}` : ""}
                  </small>
                  <h3>{live.title}</h3>
                </div>
              </div>

              {live.description && <p className="lvs-ds">{live.description}</p>}

              {!isUpcoming && !isCancelled && (
                <LiveMetrics
                  views={views}
                  likes={likes}
                  peak={peak}
                  durationSeconds={isEnded ? live.duration_seconds : undefined}
                  isLive={isLive}
                />
              )}

              {/* Destino RTMP externo (OBS/vMix) — #41 */}
              {(isUpcoming || isLive) && ingress && (
                <div className="lvs-rt">
                  <b>Encoder externo (OBS, vMix…)</b>
                  <small>
                    {isUpcoming
                      ? "Configure o encoder agora. Inicie a transmissão no OBS somente depois de clicar em ‘Ir ao vivo’."
                      : "No seu encoder, use o servidor e a chave abaixo. A transmissão entra nesta mesma live."}
                  </small>
                  <div className="row">
                    <input readOnly aria-label="Servidor (RTMP URL)" value={ingress.rtmp_url} />
                    <button
                      type="button"
                      className="btn"
                      onClick={() => copyToClipboard(ingress.rtmp_url, "Servidor")}
                    >
                      Copiar
                    </button>
                  </div>
                  <div className="row">
                    <input
                      readOnly
                      type="password"
                      aria-label="Chave de transmissão (Stream Key)"
                      value={ingress.stream_key}
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        copyToClipboard(ingress.stream_key, "Chave de transmissão")
                      }
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              {isUpcoming ? (
                <LiveChat comments={[]} idle />
              ) : isLive ? (
                <LiveChat
                  comments={comments}
                  connected={liveSocket.connected}
                  onSend={liveSocket.sendComment}
                />
              ) : (
                <LiveChat
                  comments={[]}
                  idle
                  idleText="O chat ao vivo fica disponível apenas durante a transmissão."
                />
              )}

              {isLive && confirm === "end" && (
                <div className="lvs-ft on">
                  <div className="lvs-cf">
                    <b>Encerrar a transmissão?</b>
                    <small>
                      Os espectadores serão desconectados e a gravação ficará disponível no
                      histórico quando processada.
                    </small>
                    <div>
                      <button type="button" className="btn out" onClick={() => setConfirm(null)}>
                        Continuar ao vivo
                      </button>
                      <button
                        type="button"
                        className="btn dng2"
                        onClick={handleConfirm}
                        disabled={confirmPending}
                      >
                        Encerrar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Modal de edição (Tailwind, fora do .pv) */}
      {showEdit && (
        <>
          <LiveForm
            initial={{
              title: live.title,
              description: live.description,
              host_display_name: live.host_display_name,
              scheduled_at: live.scheduled_at,
            }}
            initialThumbnailUrl={thumb}
            submitLabel="Salvar alterações"
            submittingLabel="Salvando..."
            isSubmitting={updateMutation.isPending}
            onSubmit={handleEdit}
            onCancel={() => setShowEdit(false)}
          />
        </>
      )}

      {/* Confirmações de cancelar/remover (o "encerrar" é inline no estúdio) */}
      {confirm && !(confirm === "end" && isLive) && (
        <Modal
          title={
            confirm === "end"
              ? "Encerrar transmissão?"
              : confirm === "cancel"
                ? "Cancelar agendamento?"
                : "Remover live?"
          }
          onClose={() => setConfirm(null)}
          panelClassName="max-w-md"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-700">
              {confirm === "end"
                ? "A transmissão será finalizada para todos os espectadores e a gravação ficará disponível no histórico quando processada. Esta ação não pode ser desfeita."
                : confirm === "cancel"
                  ? "A live agendada será cancelada e não ficará visível para os usuários."
                  : "A live deixará de aparecer no histórico. O registro será mantido internamente para auditoria."}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirm(null)}
                className="h-10 rounded-full px-4"
              >
                Voltar
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={confirmPending}
                className={
                  confirm === "cancel"
                    ? "h-10 rounded-full px-4"
                    : "h-10 rounded-full bg-red-600 px-4 hover:bg-red-700"
                }
              >
                <span className="font-semibold text-white">
                  {confirm === "end"
                    ? "Encerrar"
                    : confirm === "cancel"
                      ? "Cancelar agendamento"
                      : "Remover live"}
                </span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
