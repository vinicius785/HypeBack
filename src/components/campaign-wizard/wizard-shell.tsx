import { useLayoutEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";

import { TopActions } from "@/components/header";
import { I } from "@/components/prototype/ui";
import { useNiches } from "@/hooks/use-niches";
import type { CampaignFormData } from "@/shared/types";

import { Chips } from "./fields";
import {
  PAYMENT_LABEL,
  WIZARD_STEPS,
  WIZARD_SUBS,
  asList,
  money,
  paymentGain,
  stepOk,
  wizardMissing,
} from "./config";

interface WizardShellProps {
  mode: "create" | "edit";
  /** Texto do botão de voltar do topo (ex.: "Campanhas"). */
  backLabel: string;
  onExit: () => void;
  step: number;
  setStep: (n: number) => void;
  formData: CampaignFormData;
  updateFormData: (field: keyof CampaignFormData, value: unknown) => void;
  tried: boolean;
  setTried: (v: boolean) => void;
  reviewOpen: boolean;
  setReviewOpen: (v: boolean) => void;
  onPublish: () => void;
  publishing: boolean;
  workspaceName?: string;
  /** Só na criação. */
  onSaveDraft?: () => void;
  onDiscardDraft?: () => void;
  children: ReactNode;
}

const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Casca do assistente "Nova campanha" / "Editar campanha" (layout do protótipo). */
export function WizardShell(p: WizardShellProps) {
  const { formData: d, step, mode } = p;
  const edit = mode === "edit";
  const last = step === WIZARD_STEPS.length;
  const missing = wizardMissing(d);
  const { data: niches = [] } = useNiches();

  const nicheName = (ids: string) => {
    const id = ids.split(",").filter(Boolean)[0];
    return id ? niches.find((n) => String(n.id) === id)?.name : undefined;
  };
  const nicheNames = (ids: string) =>
    ids
      .split(",")
      .filter(Boolean)
      .map((id) => niches.find((n) => String(n.id) === id)?.name)
      .filter(Boolean)
      .join(", ");

  const stepRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const ind = nav?.querySelector<HTMLElement>(".ind");
    const on = nav?.querySelector<HTMLElement>("button.on");
    if (ind && on) {
      ind.style.width = `${on.offsetWidth}px`;
      ind.style.transform = `translateX(${on.offsetLeft}px)`;
    }
  }, [step]);
  const bodyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    stepRef.current?.closest("main")?.scrollTo({ top: 0 });
  }, [step]);

  const go = (n: number) => {
    p.setStep(Math.max(1, Math.min(WIZARD_STEPS.length, n)));
    p.setReviewOpen(false);
  };

  const warn = () => {
    p.setTried(true);
    toast.error("Preencha os campos obrigatórios");
  };

  const next = () => {
    if (missing.some((m) => m.step === step)) return warn();
    p.setTried(false);
    go(step + 1);
  };

  const review = () => {
    if (missing.some((m) => m.step === step)) return warn();
    p.setReviewOpen(true);
  };

  const publish = () => {
    if (missing.length) {
      p.setTried(true);
      toast.error("Faltam itens obrigatórios. Toque em um item para corrigir");
      return;
    }
    p.onPublish();
  };

  const banner = d.banner;
  const niche = nicheName(d.mainNiche) ?? nicheName(d.subniches);

  const rv = (title: string, s: number, rows: Array<[string, string]>) => (
    <div className="nrv">
      <div className="nrv-h">
        <b>{title}</b>
        <button type="button" onClick={() => go(s)}>
          Editar
        </button>
      </div>
      {rows.map(([a, b]) => (
        <div className="nrv-r" key={a}>
          <span>{a}</span>
          <b>{b || <em>Não informado</em>}</b>
        </div>
      ))}
    </div>
  );

  const products = (d.products ?? []).map((x) => x.name).filter((n) => n?.trim());

  return (
    <div className="pv">
      <div className="wrap" style={{ maxWidth: "none" }}>
        <div className="top">
          <button type="button" className="back" onClick={p.onExit}>
            <span>
              <I n="back" cls="sm" />
            </span>
            {p.backLabel}
          </button>
          <div className="gap" />
          <TopActions />
        </div>

        <div className="head fade">
          <div>
            <h1>{edit ? "Editar campanha" : "Nova campanha"}</h1>
            <p>
              Etapa {step} de {WIZARD_STEPS.length} · {WIZARD_SUBS[step - 1]}
            </p>
          </div>
        </div>

        <div className="fade nbarw">
          <div className="nbar">
            <nav className="nstp" ref={navRef}>
              <i className="ind" />
              {WIZARD_STEPS.map((l, k) => {
                const s = k + 1;
                const on = step === s;
                const done = s < step && stepOk(d, s);
                return (
                  <button key={l} type="button" className={`${on ? "on" : ""} ${done && !on ? "done" : ""}`} onClick={() => go(s)}>
                    <span>{done && !on ? <I n="check" cls="sm" /> : s}</span>
                    {l}
                  </button>
                );
              })}
            </nav>
            <div className="nact">
              <button type="button" className="btn out" disabled={step === 1} onClick={() => go(step - 1)}>
                <I n="back" cls="sm" />
                Voltar
              </button>
              {edit ? (
                <button type="button" className="btn out" onClick={p.onExit}>
                  Cancelar
                </button>
              ) : (
                <button type="button" className="btn out" onClick={p.onSaveDraft}>
                  Salvar rascunho
                </button>
              )}
              {last ? (
                <button type="button" className="btn" onClick={review}>
                  <I n="check" cls="sm" />
                  {edit ? "Revisar e salvar" : "Revisar e publicar"}
                </button>
              ) : (
                <button type="button" className="btn" onClick={next}>
                  Continuar
                  <I n="chev" cls="sm" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mg nc fade">
          <div className="gwrap">
            <div className="gmain card ncm">
              <div className="nc-h">
                <h2>{WIZARD_STEPS[step - 1]}</h2>
              </div>
              <div className="gscroll ncb stepin" ref={bodyRef} key={step}>
                {p.children}
              </div>
            </div>
          </div>

          <aside className="side2" ref={stepRef}>
            <div className="s2-top">
              <small>Como aparece no app</small>
            </div>
            <div className="pv">
              <div className="pv-i">
                {banner ? (
                  <img src={banner} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span>
                    <I n="image" />
                  </span>
                )}
                <span className="badge">{niche ?? "Nicho"}</span>
              </div>
              <div className="pv-b">
                <div className="pv-id">
                  <span className="brand" style={{ background: "var(--brand)" }}>
                    {initials(p.workspaceName ?? "") || "HY"}
                  </span>
                  <div>
                    <b className={d.title ? "" : "ph"}>{d.title || "Título da campanha"}</b>
                    <small>{p.workspaceName ?? ""}</small>
                  </div>
                </div>
                <div className="pv-s">
                  <div>
                    <small>Ganho</small>
                    <b>{paymentGain(d)}</b>
                  </div>
                  <div>
                    <small>Criadores</small>
                    <b>{d.influencersCount || 0}</b>
                  </div>
                  <div>
                    <small>Fases</small>
                    <b>{d.phases?.length ?? 0}</b>
                  </div>
                </div>
              </div>
            </div>
            <section className="s2">
              <h3>Checklist</h3>
              {(
                [
                  [1, "Campanha e materiais"],
                  [2, "Criadores"],
                  [3, "Pagamento"],
                  [4, "Fases"],
                ] as const
              ).map(([s, l]) => {
                const ok = stepOk(d, s);
                return (
                  <button key={s} type="button" className={`s2r ck ${ok ? "ok" : ""}`} onClick={() => go(s)}>
                    <b>{ok ? <I n="check" cls="sm" /> : null}</b>
                    <span>{l}</span>
                    <I n="chev" cls="sm" />
                  </button>
                );
              })}
            </section>
          </aside>
        </div>
      </div>

      {p.reviewOpen ? (
        <>
          <div className="dback on" onClick={() => p.setReviewOpen(false)} />
          <aside className="drw nrw on">
            <div className="nrw-h">
              <div>
                <small>{edit ? "Antes de salvar" : "Última etapa"}</small>
                <h2>{edit ? "Revisão das alterações" : "Revisão final"}</h2>
              </div>
              <button type="button" className="round" aria-label="Fechar" onClick={() => p.setReviewOpen(false)}>
                <I n="x" cls="sm" />
              </button>
            </div>
            <div className="nrw-b">
              {missing.length ? (
                <div className="nmiss">
                  <b>
                    Faltam {missing.length} {missing.length > 1 ? "itens" : "item"} para publicar
                  </b>
                  {missing.map((m) => (
                    <button key={m.field} type="button" onClick={() => go(m.step)}>
                      {m.label}
                      <I n="chev" cls="sm" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="nmiss ok">
                  <span>
                    <I n="check" />
                  </span>
                  <div>
                    <b>Tudo certo</b>
                    <small>Revise e {edit ? "salve" : "publique"} quando quiser</small>
                  </div>
                </div>
              )}

              {rv("Informações básicas", 1, [
                ["Título", d.title],
                ["Descrição", d.description],
                ["Objetivo geral", d.generalObjective],
                ["O que fazer", asList(d.whatToDo).join(" · ")],
                ["O que não fazer", asList(d.whatNotToDo).join(" · ")],
              ])}
              {rv("Influenciadores", 2, [
                ["Quantidade", d.influencersCount],
                ["Seguidores mínimos", d.minFollowers],
                ["Nichos", nicheNames(`${d.mainNiche},${d.subniches}`)],
                ["Estado", d.state || "Todo o Brasil"],
                ["Gênero", d.gender && d.gender !== "all" ? d.gender : ""],
              ])}
              {rv("Remuneração e benefícios", 3, [
                ["Tipo", PAYMENT_LABEL[d.paymentType] ?? ""],
                ["Valor", paymentGain(d) === "—" ? "" : paymentGain(d)],
                ["Bônus", d.benefitsBonus?.trim() ?? ""],
                ["Benefícios", asList(d.benefits).join(" · ")],
              ])}
              {rv("Materiais", 1, [
                ["Banner", d.banner ? "Enviado" : ""],
                ["Arquivos", d.brandFiles ? "Anexados" : "Nenhum"],
              ])}
              {rv("Produtos", 3, [["Produtos", products.join(", ") || "Nenhum"]])}
              {rv(
                "Fases da campanha",
                4,
                (d.phases ?? []).map((ph, i) => [
                  `Fase ${i + 1}`,
                  [
                    ph.objective,
                    ph.postDate ? ph.postDate.split("-").reverse().join("/") + (ph.postTime ? ` às ${ph.postTime}` : "") : "",
                    ph.formats.length ? ph.formats.map((f) => `${f.quantity} ${f.contentType}`).join(", ") : "",
                    ph.includeImageRights && ph.imageRightsPeriod ? `direitos de imagem: ${ph.imageRightsPeriod} meses` : "",
                  ]
                    .filter(Boolean)
                    .join(" · "),
                ]),
              )}

              {!edit ? (
                <div className="nrv">
                  <div className="nrv-h">
                    <b>Visibilidade</b>
                  </div>
                  <Chips
                    multi={false}
                    selected={d.campaignVisibility ?? "public"}
                    options={[
                      { value: "public", label: "Pública (aparece no Descobrir)" },
                      { value: "private", label: "Privada" },
                    ]}
                    onToggle={(v) => p.updateFormData("campaignVisibility", v)}
                  />
                </div>
              ) : null}
              {d.paymentType === "fixed" && d.paymentFixedAmount ? (
                <small style={{ color: "var(--muted)" }}>Cada conteúdo publicado paga {money(d.paymentFixedAmount)}.</small>
              ) : null}
              {p.onDiscardDraft ? (
                <button type="button" className="btn out dng" onClick={p.onDiscardDraft}>
                  <I n="trash" cls="sm" />
                  Descartar rascunho
                </button>
              ) : null}
            </div>
            <div className="nrw-f">
              {edit ? (
                <button type="button" className="btn out" onClick={p.onExit}>
                  Descartar
                </button>
              ) : (
                <button type="button" className="btn out" onClick={p.onSaveDraft}>
                  Salvar rascunho
                </button>
              )}
              <button type="button" className="btn" aria-disabled={missing.length > 0 || p.publishing} onClick={publish}>
                <I n={edit ? "check" : "send"} cls="sm" />
                {p.publishing ? "Enviando..." : edit ? "Salvar alterações" : "Publicar campanha"}
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
