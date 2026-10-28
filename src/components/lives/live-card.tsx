import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import type { Live } from "@/shared/types";

const DAY_MS = 86_400_000;

export function compact(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);
}

function parts(iso: string | null) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return {
    d: d.getDate(),
    m: new Intl.DateTimeFormat("pt-BR", { month: "short" })
      .format(d)
      .replace(".", ""),
    tm: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d),
    date: d,
  };
}

function dayLabel(date: Date): string {
  const a = new Date(date);
  a.setHours(0, 0, 0, 0);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  const off = Math.round((a.getTime() - b.getTime()) / DAY_MS);
  if (off === 0) return "Hoje";
  if (off === 1) return "Amanhã";
  if (off > 0) return `em ${off} dias`;
  if (off === -1) return "ontem";
  return `há ${-off} dias`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${r}` : `${m}:${r}`;
}

export function fmtDuration(s: number | null): string {
  if (!s || s <= 0) return "—";
  if (s >= 3600)
    return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
  return `${Math.max(1, Math.floor(s / 60))} min`;
}

/** Capa real da live; sem capa, gradiente com as iniciais do título. */
function LiveImg({ live, cls = "" }: { live: Live; cls?: string }) {
  const src = getUploadUrl(live.thumbnail_url ?? undefined);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const initials = live.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className={`lvx-im ${cls}`}>
      {src && !broken ? (
        <img
          className="lvx-up"
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          className="lvx-s"
          style={{
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(135deg,#ff6a3d,#c2185b)",
            color: "#fff",
            fontWeight: 700,
            fontSize: cls === "sm" ? 20 : 44,
            letterSpacing: "-.04em",
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

function useGo(live: Live) {
  const navigate = useNavigate();
  return () => navigate({ to: "/lives/$liveId", params: { liveId: live.id } });
}

/** Cartão grande da transmissão ao vivo. */
export function LiveBigCard({
  live,
  canWrite,
  ending,
  onEnd,
}: {
  live: Live;
  canWrite: boolean;
  ending: boolean;
  onEnd: (live: Live) => void;
}) {
  const go = useGo(live);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const startedAt = live.started_at ? new Date(live.started_at).getTime() : null;
  const sec = startedAt ? (now - startedAt) / 1000 : 0;
  return (
    <article className="lvx-big">
      <LiveImg live={live} cls="big" />
      <div className="lvx-bd">
        <span className="lvx-lv">
          <i />
          AO VIVO
        </span>
        <span className="lvx-vw">
          <I n="eye" cls="sm" />
          {live.views_count}
        </span>
      </div>
      <div className="lvx-bi">
        {startedAt && (
          <small>
            Transmitindo há <b>{fmtClock(sec)}</b>
          </small>
        )}
        <h2>{live.title}</h2>
        {live.description && <p>{live.description}</p>}
        <div className="lvx-st">
          <div>
            <small>Assistindo agora</small>
            <b>{live.views_count}</b>
          </div>
          <div>
            <small>Curtidas</small>
            <b>{compact(live.likes_count)}</b>
          </div>
          <div>
            <small>Duração</small>
            <b>{fmtClock(sec)}</b>
          </div>
        </div>
        <div className="lvx-ac">
          <button type="button" className="btn" onClick={go}>
            <I n="video" cls="sm" />
            Entrar no estúdio
          </button>
          {canWrite && (
            <button
              type="button"
              className="btn out"
              disabled={ending}
              onClick={() => onEnd(live)}
            >
              Encerrar live
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** Cartão de live agendada (com confirmação inline de cancelamento). */
export function LiveSchedCard({
  live,
  k,
  canWrite,
  confirming,
  cancelling,
  onAsk,
  onKeep,
  onCancel,
}: {
  live: Live;
  k: number;
  canWrite: boolean;
  confirming: boolean;
  cancelling: boolean;
  onAsk: (live: Live) => void;
  onKeep: () => void;
  onCancel: (live: Live) => void;
}) {
  const go = useGo(live);
  const p = parts(live.scheduled_at);
  return (
    <article className="lvx-c" style={{ ["--k" as string]: k }}>
      <div onClick={go} style={{ cursor: "pointer" }}>
        <LiveImg live={live} />
      </div>
      {p && (
        <>
          <div className="lvx-dp">
            <b>{p.d}</b>
            <small>{p.m}</small>
          </div>
          <span className="lvx-cd">
            {dayLabel(p.date)} · {p.tm}
          </span>
        </>
      )}
      <div className="lvx-cb">
        <h3>{live.title}</h3>
        {live.description && <p>{live.description}</p>}
        {confirming ? (
          <div className="lvx-cf">
            <b>Cancelar esta live?</b>
            <div>
              <button type="button" className="btn out" onClick={onKeep}>
                Manter
              </button>
              <button
                type="button"
                className="btn dng2"
                disabled={cancelling}
                onClick={() => onCancel(live)}
              >
                Cancelar live
              </button>
            </div>
          </div>
        ) : (
          <div className="lvx-ca">
            <button type="button" className="btn" onClick={go}>
              <I n="video" cls="sm" />
              Iniciar agora
            </button>
            {canWrite && (
              <>
                <button
                  type="button"
                  className="round"
                  aria-label="Editar"
                  onClick={go}
                >
                  <I n="notepad" cls="sm" />
                </button>
                <button
                  type="button"
                  className="round"
                  aria-label="Cancelar live"
                  onClick={() => onAsk(live)}
                >
                  <I n="trash" cls="sm" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** Linha da lista de lives encerradas. */
export function LivePastRow({ live, k }: { live: Live; k: number }) {
  const go = useGo(live);
  const p = parts(live.ended_at ?? live.started_at ?? live.scheduled_at);
  const hasVod = live.recording_status === "ready";
  return (
    <div
      className="lvx-r"
      style={{
        ["--k" as string]: k,
        gridTemplateColumns: "64px minmax(200px,1.7fr) 150px 100px 80px 120px",
      }}
    >
      <div className="lvx-ri">
        <LiveImg live={live} cls="sm" />
      </div>
      <div className="lvx-rn">
        <b>{live.title}</b>
        {live.host_display_name && <small>{live.host_display_name}</small>}
      </div>
      <span>{p ? `${p.d} ${p.m} · ${p.tm}` : "—"}</span>
      <span>{fmtDuration(live.duration_seconds)}</span>
      <span>{compact(live.likes_count)}</span>
      <button type="button" className="btn out" onClick={go}>
        <I n="video" cls="sm" />
        {hasVod ? "Reprise" : "Detalhes"}
      </button>
    </div>
  );
}

/** Linha da lista de lives canceladas. */
export function LiveCancRow({ live, k }: { live: Live; k: number }) {
  const go = useGo(live);
  const p = parts(live.scheduled_at);
  return (
    <div className="lvx-r" style={{ ["--k" as string]: k }}>
      <div className="lvx-ri">
        <LiveImg live={live} cls="sm" />
      </div>
      <div className="lvx-rn">
        <b>{live.title}</b>
        <small>
          Cancelada{p ? ` · era para ${p.d} ${p.m}, ${p.tm}` : ""}
        </small>
      </div>
      <button type="button" className="btn out" onClick={go}>
        <I n="cal" cls="sm" />
        Detalhes
      </button>
    </div>
  );
}
