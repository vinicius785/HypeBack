import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import hypeappLogoBranca from "@/assets/images/hypeapp-logo-branca.svg";
import { BrandAvatar, brandOf, brl, fixedAmount } from "@/components/campaign-invite/parts";
import { CampaignInviteAcceptModal } from "@/components/campaign-invite-accept-modal";
import { CampaignInviteDeclineModal } from "@/components/campaign-invite-decline-modal";
import { I } from "@/components/prototype/ui";
import { usePublicCampaignInvite } from "@/hooks/use-public-campaign-invite";
import { getUploadUrl } from "@/lib/utils/api";
import {
  HYPEAPP_ANDROID_PLAY_STORE_URL,
  HYPEAPP_IOS_APP_STORE_URL,
} from "@/shared/config/app-links";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import type { PublicCampaignInviteData } from "@/shared/services/public-campaign-invite";
import { formatContentTypeLabel } from "@/shared/utils/social-profile-url";

export const Route = createFileRoute("/(public)/campaigns/$campaignId/invite")({
  component: PublicCampaignInviteScreen,
});

const PAYMENT_LABEL: Record<string, string> = {
  fixed: "Pagamento fixo por influenciador",
  swap: "Permuta",
  cpa: "CPA (por ação)",
  cpm: "CPM",
};

const HERO_PAY: Record<string, string> = { swap: "Permuta", cpa: "CPA", cpm: "CPM" };

const NETWORK_ICON: Record<string, string> = {
  instagram: "instagram",
  youtube: "youtube",
  tiktok: "tiktok",
};

/** "2026-10-28" → "28 de outubro" (sem deslocar o dia por fuso). */
function shortDate(iso?: string): string {
  if (!iso?.trim()) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

/** "18:00:00" → "18:00". */
function shortTime(t?: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : (t ?? "");
}

const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Texto da marca com `**negrito**` e linhas "- item" (vindos como markdown simples). */
function Rich({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <b key={i}>{part.slice(2, -2)}</b>
      ) : (
        part
      ),
    );
  const blocks: Array<{ list: boolean; lines: string[] }> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ list: false, lines: [] });
      continue;
    }
    const isItem = /^[-•]\s+/.test(line);
    const last = blocks[blocks.length - 1];
    const clean = isItem ? line.replace(/^[-•]\s+/, "") : line;
    if (last && last.lines.length && last.list === isItem && isItem) last.lines.push(clean);
    else blocks.push({ list: isItem, lines: [clean] });
  }
  return (
    <>
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.list ? (
            <ul key={i} style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.6 }}>
              {b.lines.map((l, j) => (
                <li key={j}>{inline(l)}</li>
              ))}
            </ul>
          ) : (
            <p key={i} style={{ margin: i ? "10px 0 0" : 0 }}>
              {b.lines.map((l, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  {inline(l)}
                </span>
              ))}
            </p>
          ),
        )}
    </>
  );
}

function Title({ a, b }: { a: string; b: string }) {
  return (
    <h1 className="pvx-h">
      {a} <span>{b}</span>
    </h1>
  );
}

function Item({ icon, title, text, cls = "" }: { icon: string; title: string; text?: string; cls?: string }) {
  return (
    <div className={`pvx-it ${cls}`.trim()}>
      <span>
        <I n={icon} cls="sm" />
      </span>
      <div>
        <b>{title}</b>
        {text ? <p>{text}</p> : null}
      </div>
    </div>
  );
}

function Page({ children, scrollRef }: { children: React.ReactNode; scrollRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div className="pv">
      <div ref={scrollRef} className="cvx on" id="cvx">
        {children}
      </div>
    </div>
  );
}

function PublicCampaignInviteScreen() {
  const { campaignId } = useParams({ from: "/(public)/campaigns/$campaignId/invite" });
  const { data, isLoading, isError, error } = usePublicCampaignInvite(campaignId);

  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const phases = useMemo(
    () => (data?.phases ?? []).slice().sort((a, b) => a.order - b.order),
    [data?.phases],
  );

  // Animação de entrada ao rolar (protótipo `cvReveal`) e contagem do valor.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !data) return;
    const sel = [
      ".pvx-tp",
      ".pvx-hl",
      ".pvx-stk",
      ".pvx-sec > .pvx-h",
      ".pvx-sec > .pvx-cd",
      ".pvx-tl li",
      ".pvx-it",
      ".pvx-pay",
      ".pvx-fa",
      ".pvx-fb2 > div",
      ".pvx-fz",
    ];
    const els = [...new Set([...root.querySelectorAll<HTMLElement>(sel.join(","))])];
    els.forEach((e) => {
      const sib = [...(e.parentElement?.children ?? [])].filter((x) => els.includes(x as HTMLElement));
      e.style.setProperty("--d", `${Math.min(sib.indexOf(e), 4) * 90}ms`);
    });
    if (!("IntersectionObserver" in window)) return;

    const amount = fixedAmount(data);
    const payB = root.querySelector<HTMLElement>(".pvx-pay b");
    if (payB && amount != null) payB.textContent = brl(0);

    const count = (el: HTMLElement) => {
      const b = el.querySelector<HTMLElement>("b");
      if (!b || amount == null) return;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 1300);
        b.textContent = brl(Math.round(amount * (1 - Math.pow(1 - p, 4))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((x) => {
          if (!x.isIntersecting) return;
          const t = x.target as HTMLElement;
          t.classList.add("in");
          io.unobserve(t);
          if (t.classList.contains("pvx-pay")) count(t);
        }),
      { root, threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    els.forEach((e) => {
      e.classList.add("rv");
      io.observe(e);
    });
    return () => io.disconnect();
  }, [data]);

  if (isLoading) {
    return (
      <Page>
        <div className="pvx-pg">
          <div className="ov-empty big">
            <span>
              <I n="mega" />
            </span>
            <b>Carregando convite…</b>
          </div>
        </div>
      </Page>
    );
  }

  if (isError || !data) {
    const is404 = (error as { status?: number })?.status === 404;
    return (
      <Page>
        <div className="pvx-pg">
          <div className="ov-empty big">
            <span>
              <I n="ban" />
            </span>
            <b>Convite indisponível</b>
            <small>
              {is404
                ? "Este convite não está disponível ou a campanha não foi encontrada."
                : (error as Error)?.message || "Não foi possível carregar os dados da campanha."}
            </small>
            <Link to="/sign-in" className="btn out">
              Entrar no backoffice
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <>
      <InviteView
        data={data}
        phases={phases}
        accepted={accepted}
        declined={declined}
        scrollRef={scrollRef}
        onAccept={() => setAcceptOpen(true)}
        onDecline={() => setDeclineOpen(true)}
      />
      <CampaignInviteAcceptModal
        isOpen={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        campaignPublicId={campaignId}
        campaignTitle={data.title}
        inviteData={data}
        onAccepted={() => setAccepted(true)}
      />
      <CampaignInviteDeclineModal
        isOpen={declineOpen}
        onClose={() => setDeclineOpen(false)}
        campaignPublicId={campaignId}
        inviteData={data}
        onDeclineRecorded={() => setDeclined(true)}
      />
    </>
  );
}

function InviteView({
  data,
  phases,
  accepted,
  declined,
  scrollRef,
  onAccept,
  onDecline,
}: {
  data: PublicCampaignInviteData;
  phases: NonNullable<PublicCampaignInviteData["phases"]>;
  accepted: boolean;
  declined: boolean;
  scrollRef: React.Ref<HTMLDivElement>;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const banner = data.banner ? getUploadUrl(data.banner) ?? undefined : undefined;
  const fixed = fixedAmount(data);
  const networks = data.allowed_social_networks ?? [];
  const niches = data.niches ?? [];
  const subNiches = data.secondary_niche_names ?? [];
  const benefits = data.benefits ?? [];
  const does = data.rules_does ?? [];
  const doesNot = data.rules_does_not ?? [];
  const description =
    data.description?.trim() || "Detalhes desta ação serão divulgados pela marca ou pelo aplicativo Hypeapp.";
  const deliveries = phases.reduce(
    (sum, p) => sum + p.formats.reduce((s, f) => s + (f.quantity && f.quantity > 0 ? f.quantity : 0), 0),
    0,
  );
  const paymentLabel = data.payment_method
    ? PAYMENT_LABEL[data.payment_method.toLowerCase()] ?? "A combinar"
    : "";
  const paymentText = data.payment_method_details?.description?.trim();
  const hasPay = Boolean(fixed != null || paymentLabel || paymentText);

  const hint = (net: string) => {
    const types = new Set<string>();
    phases.forEach((p) =>
      p.formats.forEach((f) => {
        if (f.network === net && f.content_type) types.add(formatContentTypeLabel(f.network, f.content_type));
      }),
    );
    return [...types].join(" e ");
  };

  const profile: Array<[string, string, string]> = [];
  if (data.segment_min_followers && data.segment_min_followers > 0)
    profile.push(["eye", "Seguidores mínimos", `${data.segment_min_followers.toLocaleString("pt-BR")}+`]);
  if (niches.length) profile.push(["tag", "Nichos", niches.join(" · ")]);
  if (subNiches.length) profile.push(["tag", "Subnichos", subNiches.join(" · ")]);
  if (data.image_rights_period && data.image_rights_period > 0)
    profile.push(["image", "Uso de imagem", `Direitos de imagem por ${data.image_rights_period} meses`]);

  return (
    <div className="pv">
      <div ref={scrollRef} className="cvx on" id="cvx">
        <div className="pvx-pg">
          <header className="pvx-tp">
            <span className="pvx-ch">
              <BrandAvatar data={data} />
              {brandOf(data)}
            </span>
            <Link to="/sign-in" className="pvx-rb" aria-label="Área da marca" title="Área da marca">
              <I n="lock" cls="sm" />
            </Link>
          </header>

          <div className="pvx-bd">
            <div className="pvx-hero">
              <div className="pvx-hl">
                <h1 className="pvx-h">
                  Oi, criador! <span>Você foi convidado para a campanha {data.title}.</span>
                </h1>
                <p className="pvx-lead">
                  Uma marca quer trabalhar com você. Veja os detalhes e responda quando quiser.
                </p>
              </div>
              <div className="pvx-stk">
                <i />
                <i />
                <div className="pvx-mc">
                  {banner ? (
                    <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", background: "#111" }}>
                      <img
                        src={banner}
                        alt={data.title}
                        style={{ display: "block", width: "100%", height: "auto" }}
                      />
                      {data.max_influencers && data.max_influencers > 0 ? (
                        <span className="pvx-pl" style={{ position: "absolute", top: 12, right: 12 }}>
                          {data.max_influencers} vagas
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="pvx-mt">
                      <b>
                        Campanha
                        <br />
                        {data.title}
                      </b>
                      {data.max_influencers && data.max_influencers > 0 ? (
                        <span className="pvx-pl">{data.max_influencers} vagas</span>
                      ) : null}
                    </div>
                  )}
                  <div className="pvx-mb">
                    <BrandAvatar data={data} />
                    <div>
                      <b>{brandOf(data)}</b>
                      <small>{niches.slice(0, 3).join(" · ") || "Convite para criadores"}</small>
                    </div>
                    {fixed != null ? (
                      <div className="pvx-pr">
                        <b>{brl(fixed)}</b>
                        <small>valor fixo</small>
                      </div>
                    ) : paymentLabel ? (
                      <div className="pvx-pr">
                        <b>{HERO_PAY[data.payment_method?.toLowerCase() ?? ""] ?? "A combinar"}</b>
                        <small>remuneração</small>
                      </div>
                    ) : null}
                  </div>
                  <div className="pvx-mm">
                    <div>
                      <small>Fases</small>
                      <b>{phases.length || "A definir"}</b>
                    </div>
                    <div>
                      <small>Entregas</small>
                      <b>{deliveries > 0 ? `${deliveries} no total` : networks.map((n) => getNetworkLabel(n, n)).join(" + ") || "A definir"}</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pvx-secs">
              <section className="pvx-sec" id="cvs-about">
                <Title a="Sobre" b="a campanha" />
                <div className="pvx-cd">
                  <Rich text={description} />
                </div>
                {data.objective?.trim() ? (
                  <div className="pvx-cd">
                    <small className="pvx-lb">Objetivo</small>
                    <Rich text={data.objective} />
                  </div>
                ) : null}
                {networks.length > 0 ? (
                  <div className="pvx-cd">
                    <small className="pvx-lb">Onde publicar</small>
                    <div className="pvx-nets">
                      {networks.map((n) => (
                        <div key={n}>
                          <span>
                            <I n={NETWORK_ICON[n] ?? "link"} />
                          </span>
                          <div>
                            <b>{getNetworkLabel(n, n)}</b>
                            {hint(n) ? <small>{hint(n)}</small> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {profile.length > 0 ? (
                  <div className="pvx-cd">
                    <small className="pvx-lb">Perfil buscado</small>
                    {profile.map(([icon, t, x]) => (
                      <Item key={t} icon={icon} title={t} text={x} />
                    ))}
                  </div>
                ) : null}
              </section>

              {phases.length > 0 ? (
                <section className="pvx-sec" id="cvs-steps">
                  <Title a="Entregas" b="e prazos" />
                  <ol className={`pvx-tl${phases.length < 3 ? " compact" : ""}`}>
                    {phases.map((p, i) => {
                      const when = [shortDate(p.post_date), p.publish_time ? `às ${shortTime(p.publish_time)}` : ""]
                        .filter(Boolean)
                        .join(" ");
                      const byNet = new Map<string, string[]>();
                      p.formats.forEach((f) => {
                        const item = [
                          f.content_type ? formatContentTypeLabel(f.network, f.content_type) : "",
                          f.quantity && f.quantity > 0 ? `${f.quantity}x` : "",
                        ]
                          .filter(Boolean)
                          .join(" ");
                        byNet.set(f.network, [...(byNet.get(f.network) ?? []), item].filter(Boolean));
                      });
                      return (
                        <li key={`${p.order}-${i}`}>
                          <span>{i + 1}</span>
                          <div className="pvx-cd">
                            <div className="pvx-pt">
                              <b>Fase {p.order}</b>
                              {when ? <em>{when}</em> : null}
                            </div>
                            <p>{cap(p.objective)}</p>
                            {[...byNet].map(([net, items]) => (
                              <p key={net} style={{ marginTop: 6 }}>
                                <b>{getNetworkLabel(net, net)}</b>
                                {items.length ? `: ${items.join(", ")}` : ""}
                              </p>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ) : null}

              {does.length > 0 || doesNot.length > 0 ? (
                <section className="pvx-sec full" id="cvs-rules">
                  <Title a="O que fazer" b="e evitar" />
                  <div className="pvx-rl">
                    {does.length > 0 ? (
                      <div>
                        <small className="pvx-lb">A marca espera</small>
                        {does.map((x) => (
                          <Item key={x} icon="check" title={x} cls="ok" />
                        ))}
                      </div>
                    ) : null}
                    {doesNot.length > 0 ? (
                      <div>
                        <small className="pvx-lb">Evitar</small>
                        {doesNot.map((x) => (
                          <Item key={x} icon="x" title={x} cls="no" />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>

        <div className="pvx-dk">
          <div className="pvx-dkc">
            {hasPay || benefits.length > 0 ? (
              <section className="pvx-sec full" id="cvs-perks">
                <Title a="O que você" b="ganha" />
                <div className="pvx-gn">
                  <div className="pvx-pay">
                    <small>Remuneração</small>
                    <b>{fixed != null ? brl(fixed) : paymentLabel || "A combinar"}</b>
                    <p>
                      {paymentText ||
                        (fixed != null
                          ? "Pagamento fixo por influenciador."
                          : "Os valores e condições são alinhados com a marca após a aprovação.")}
                    </p>
                  </div>
                  {benefits.length > 0 ? (
                    <div className="pvx-pk">
                      {benefits.map((x, i) => (
                        <Item key={x} icon={["box", "wallet", "heart"][i % 3]} title={x} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            <footer className="pvx-fo2">
              <div className="pvx-fm">
                <div className="pvx-fa">
                  <div className="pvx-lo2">
                    <img src={hypeappLogoBranca} alt="HypeApp" style={{ height: 40, width: "auto" }} />
                  </div>
                  <p>
                    O HypeApp conecta marcas a criadores de conteúdo. Receba convites de campanhas, envie
                    seus roteiros, publique e seja pago, tudo em um só lugar.
                  </p>
                  <div className="pvx-st">
                    <a className="btn" href={HYPEAPP_IOS_APP_STORE_URL} rel="noopener noreferrer">
                      App Store
                    </a>
                    <a className="btn out" href={HYPEAPP_ANDROID_PLAY_STORE_URL} rel="noopener noreferrer">
                      Google Play
                    </a>
                  </div>
                </div>
                <div className="pvx-fb2">
                  {[
                    ["users", "Marcas verificadas", "Só campanhas de marcas que passaram pela nossa análise."],
                    ["wallet", "Pagamento garantido", "O valor fica reservado antes da campanha começar."],
                    ["msg", "Tudo no app", "Roteiro, aprovação, contrato e chat em um só lugar."],
                  ].map(([i, t, x]) => (
                    <div key={t}>
                      <span>
                        <I n={i} />
                      </span>
                      <b>{t}</b>
                      <p>{x}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pvx-fz">
                <small>© {new Date().getFullYear()} HypeApp</small>
                <small>
                  <a>Termos de uso</a> · <a>Privacidade</a>
                </small>
              </div>
            </footer>
          </div>
        </div>

        <div className="pvx-fb">
          {declined ? (
            <div className="pvx-nt">
              Registramos que você não vai participar. Se mudar de ideia, peça um novo convite à marca.
            </div>
          ) : accepted ? (
            <div className="pvx-ok">
              <I n="check" cls="sm" />
              Convite aceito. Continue no app.
            </div>
          ) : (
            <div className="pvx-ac">
              <button type="button" className="btn" onClick={onAccept}>
                Aceitar convite
                <I n="chev" cls="sm" />
              </button>
              <button type="button" className="pvx-no" onClick={onDecline}>
                Recusar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
