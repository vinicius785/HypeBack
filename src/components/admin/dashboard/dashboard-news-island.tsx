import { useEffect, useRef, useState, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import { formatDateTime, formatRelativeTime } from "@/lib/admin/format";

import { useDashboardNews, type DashboardNews, type DashboardNewsKind } from "./use-dashboard-news";

import "@/styles/management-board.css";
import "@/styles/admin-dashboard.css";

const NEWS_LABEL: Record<DashboardNewsKind, string> = {
  workspace: "Novo cliente",
  user: "Novo usuário",
  creator: "Novo criador",
  campaign: "Nova campanha",
  application: "Nova inscrição",
  charge: "Aporte pago",
  withdrawal: "Saque pago",
};

/** Ícone e movimento de cada novidade. */
const NEWS_ICON: Record<DashboardNewsKind, { icon: string; anim: "bob" | "rise" | "radar" | "pop" }> = {
  workspace: { icon: "box", anim: "bob" },
  user: { icon: "user", anim: "bob" },
  creator: { icon: "star", anim: "pop" },
  campaign: { icon: "mega", anim: "bob" },
  application: { icon: "users", anim: "radar" },
  charge: { icon: "banknote", anim: "rise" },
  withdrawal: { icon: "wallet", anim: "rise" },
};

/** Quanto tempo a ilha fica aberta, mostrando a novidade inteira, antes de voltar ao tamanho de repouso. */
const ANNOUNCE_MS = 6000;

/**
 * A ilha "dinâmica" do Dashboard (padrão Dynamic Island do Gerenciamento): mostra só a ÚLTIMA novidade da plataforma
 * (cliente, usuário, criador, campanha, inscrição, aporte ou saque). Em repouso é uma pílula pequena; quando chega uma
 * novidade ela se abre com mola, anuncia por alguns segundos (ícone animado, quem e o quê) e volta ao repouso. Na
 * primeira carga não anuncia (não é novidade, é o que já estava lá). O horário é atualizado a cada minuto.
 */
export function DashboardNewsIsland({ activity, controls }: { activity: Parameters<typeof useDashboardNews>[0]; controls?: ReactNode }) {
  const news = useDashboardNews(activity);
  const [shown, setShown] = useState<DashboardNews | null>(null);
  const [announcing, setAnnouncing] = useState(false);
  const seen = useRef<string | null>(null);

  // A cada minuto, o "há 3 min" se atualiza sozinho.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!news) return;
    setShown(news);
    if (seen.current !== null && seen.current !== news.id) {
      // Chegou novidade (não é a primeira carga): abre e anuncia.
      setAnnouncing(true);
      const timer = window.setTimeout(() => setAnnouncing(false), ANNOUNCE_MS);
      seen.current = news.id;
      return () => window.clearTimeout(timer);
    }
    seen.current = news.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a ilha reage só à troca de novidade (`id`)
  }, [news?.id]);

  if (!shown) {
    return (
      <section className="isl isl-news" aria-label="Última novidade" data-state="idle">
        <div className="isl-news-in">
          <span className="isl-news-ico" aria-hidden="true">
            <I n="sparkles" cls="sm" />
          </span>
          <span className="isl-news-t">
            <b>Sem novidades ainda</b>
          </span>
        </div>
        {controls ? <div className="isl-news-ctl">{controls}</div> : null}
      </section>
    );
  }

  const meta = NEWS_ICON[shown.kind];
  return (
    <section
      className="isl isl-news"
      aria-label="Última novidade"
      data-state={announcing ? "announce" : "idle"}
      data-kind={shown.kind}
    >
      {/* `key`: a cada novidade o conteúdo troca com uma entrada nova (o ícone volta a animar) */}
      <div className="isl-news-in" key={shown.id} role="status">
        <span className="isl-news-ico" data-anim={meta.anim} aria-hidden="true">
          <I n={meta.icon} cls="sm" />
        </span>
        <span className="isl-news-t">
          <span className="isl-news-eyebrow">
            <b>{NEWS_LABEL[shown.kind]}</b>
            <time className="isl-news-when" dateTime={shown.at} title={formatDateTime(shown.at)}>
              {formatRelativeTime(shown.at)}
            </time>
          </span>
          <small>{shown.subject}</small>
        </span>
      </div>
      {controls ? <div className="isl-news-ctl">{controls}</div> : null}
    </section>
  );
}
