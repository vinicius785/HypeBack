import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import {
  LiveBigCard,
  LiveCancRow,
  LivePastRow,
  LiveSchedCard,
  compact,
} from "@/components/lives/live-card";
import { useCancelLive, useEndLive, useLives } from "@/hooks/use-lives";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import type { Live, LiveStatusFilter } from "@/shared/types";

export const Route = createFileRoute("/(private)/(app)/lives")({
  component: RouteComponent,
});

const TABS: Array<{ id: LiveStatusFilter; label: string }> = [
  { id: "live", label: "Ao vivo" },
  { id: "upcoming", label: "Agendadas" },
  { id: "past", label: "Anteriores" },
  { id: "cancelled", label: "Canceladas" },
];

const EMPTY_BY_TAB: Record<string, { title: string; description: string }> = {
  live: {
    title: "Nenhuma transmissão ao vivo agora",
    description: "Inicie uma live agendada ou crie uma nova para começar.",
  },
  upcoming: {
    title: "Nenhuma live agendada",
    description:
      "Programe uma transmissão para os criadores e a audiência não perderem.",
  },
  past: {
    title: "Nenhuma live anterior",
    description: "O histórico das suas transmissões encerradas aparece aqui.",
  },
  cancelled: {
    title: "Nenhuma live cancelada",
    description: "Agendamentos cancelados ficam listados aqui.",
  },
};

const EMPTY_ICON: Record<string, string> = {
  live: "video",
  upcoming: "cal",
  past: "video",
  cancelled: "x",
};

function RouteComponent() {
  const location = useLocation();
  const navigate = useNavigate();
  const permissions = useWorkspacePermissions();
  const canWrite = permissions.community_lives_write;
  const [activeTab, setActiveTab] = useState<LiveStatusFilter>("live");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useLives(activeTab);
  const endMutation = useEndLive();
  const cancelMutation = useCancelLive();

  const lives = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const segRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLElement>(null);
  const moveInd = useCallback(() => {
    const on = segRef.current?.querySelector<HTMLElement>("button.on");
    const ind = indRef.current;
    if (!on || !ind) return;
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.transform = `translateX(${on.offsetLeft}px)`;
  }, []);
  useLayoutEffect(() => {
    moveInd();
    window.addEventListener("resize", moveInd);
    return () => window.removeEventListener("resize", moveInd);
  }, [moveInd, activeTab, location.pathname]);

  const stats = useMemo(
    () => ({
      views: lives.reduce((a, l) => a + l.views_count, 0),
      likes: lives.reduce((a, l) => a + l.likes_count, 0),
    }),
    [lives],
  );

  // Rotas filhas (/lives/new, /lives/$liveId) renderizam via Outlet.
  if (location.pathname !== "/lives") {
    return <Outlet />;
  }

  const goNew = () => navigate({ to: "/lives/new" });

  const onEnd = (live: Live) =>
    endMutation.mutate(live.id, {
      onSuccess: () => {
        toast.success("Live encerrada");
        setActiveTab("past");
      },
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : "Erro ao encerrar a live."),
    });

  const onCancel = (live: Live) =>
    cancelMutation.mutate(live.id, {
      onSuccess: () => {
        setConfirmId(null);
        toast.success("Live cancelada");
      },
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : "Erro ao cancelar a live."),
    });

  const wrap = (children: React.ReactNode) => (
    <div className="pv">
      <div className="wrap" style={{ maxWidth: "none" }}>
        {children}
      </div>
    </div>
  );

  if (!permissions.community_lives_read) {
    return wrap(
      <div className="ov-empty big lvx-em">
        <span>
          <I n="lock" />
        </span>
        <b>Sem acesso às Lives</b>
        <small>
          Você não tem permissão para visualizar as transmissões deste
          workspace.
        </small>
      </div>,
    );
  }

  const empty = EMPTY_BY_TAB[activeTab];

  const body = () => {
    if (isLoading)
      return (
        <div className="ov-empty big lvx-em">
          <small>Carregando…</small>
        </div>
      );
    if (error)
      return (
        <div className="ov-empty big lvx-em">
          <span>
            <I n="x" />
          </span>
          <b>Erro ao carregar as lives</b>
          <small>{error instanceof Error ? error.message : "Tente novamente."}</small>
        </div>
      );
    if (lives.length === 0)
      return (
        <div className="ov-empty big lvx-em">
          <span>
            <I n={EMPTY_ICON[activeTab]} />
          </span>
          <b>{empty.title}</b>
          <small>{empty.description}</small>
          {canWrite && (activeTab === "live" || activeTab === "upcoming") && (
            <button type="button" className="btn" onClick={goNew}>
              <I n={activeTab === "live" ? "video" : "plus"} cls="sm" />
              {activeTab === "live" ? "Transmitir agora" : "Agendar live"}
            </button>
          )}
        </div>
      );

    let list: React.ReactNode;
    if (activeTab === "live") {
      list = lives.map((l) => (
        <LiveBigCard
          key={l.id}
          live={l}
          canWrite={canWrite}
          ending={endMutation.isPending}
          onEnd={onEnd}
        />
      ));
    } else if (activeTab === "upcoming") {
      list = (
        <div className="lvx-g">
          {lives.map((l, k) => (
            <LiveSchedCard
              key={l.id}
              live={l}
              k={k}
              canWrite={canWrite}
              confirming={confirmId === l.id}
              cancelling={cancelMutation.isPending}
              onAsk={(x) => setConfirmId(x.id)}
              onKeep={() => setConfirmId(null)}
              onCancel={onCancel}
            />
          ))}
          {canWrite && (
            <button
              type="button"
              className="lvx-c lvx-nw"
              style={{ ["--k" as string]: lives.length }}
              onClick={goNew}
            >
              <span>
                <I n="plus" />
              </span>
              <b>Agendar nova live</b>
              <small>Escolha data, horário e capa</small>
            </button>
          )}
        </div>
      );
    } else if (activeTab === "past") {
      list = (
        <>
          <div
            className="lvx-sm"
            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            <div>
              <small>Visualizações</small>
              <b>{compact(stats.views)}</b>
            </div>
            <div>
              <small>Curtidas</small>
              <b>{compact(stats.likes)}</b>
            </div>
            <div>
              <small>Lives encerradas</small>
              <b>{lives.length}{hasNextPage ? "+" : ""}</b>
            </div>
          </div>
          <div className="lvx-ls">
            <div
              className="lvx-lh"
              style={{
                gridTemplateColumns:
                  "64px minmax(200px,1.7fr) 150px 100px 80px 120px",
              }}
            >
              <span />
              <span>Live</span>
              <span>Data</span>
              <span>Duração</span>
              <span>Curtidas</span>
              <span />
            </div>
            {lives.map((l, k) => (
              <LivePastRow key={l.id} live={l} k={k} />
            ))}
          </div>
        </>
      );
    } else {
      list = (
        <div className="lvx-ls canc">
          {lives.map((l, k) => (
            <LiveCancRow key={l.id} live={l} k={k} />
          ))}
        </div>
      );
    }

    return (
      <>
        {list}
        {hasNextPage && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <button
              type="button"
              className="btn out"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
            </button>
          </div>
        )}
      </>
    );
  };

  return wrap(
    <>
      <div className="head fade lvhd">
        <div>
          <h1>Lives</h1>
          <p>Transmita ao vivo para a sua audiência e acompanhe o desempenho.</p>
        </div>
        {canWrite && (
          <div className="btns">
            <button type="button" className="btn out" onClick={goNew}>
              <I n="cal" cls="sm" />
              Agendar live
            </button>
            <button type="button" className="btn" onClick={goNew}>
              <i className="lvx-rec" />
              Transmitir agora
            </button>
          </div>
        )}
      </div>
      <div className="tools fade lvtl">
        <div className="seg" id="lvseg" ref={segRef}>
          <i className="ind" ref={indRef} />
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={activeTab === t.id ? "on" : ""}
              onClick={() => {
                setConfirmId(null);
                setActiveTab(t.id);
              }}
            >
              {t.id === "live" && <i className="lvx-dot" />}
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="fade lvrs" key={activeTab}>
        {body()}
      </div>
    </>,
  );
}
