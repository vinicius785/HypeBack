import { useEffect, useMemo, useRef, useState } from "react";

import { I } from "@/components/prototype/ui";
import { useInfluencersCatalog } from "@/hooks/use-catalog";
import { useNiches } from "@/hooks/use-niches";
import {
  BRAZILIAN_STATES,
  buildCityKey,
  getCitiesByState,
  parseCityKey,
  retainCitiesForStates,
} from "@/shared/data/brazilian-states-cities";
import {
  getNicheIdKey,
  isNicheChildOf,
  isNicheRoot,
} from "@/shared/utils/niche-tree";

import { Chips, Dropdown, FieldError, SectionCard } from "./fields";
import type { WizardStepProps } from "./types";

/* ===== Constantes do protótipo ===== */

const FMAX = 24;

type Tier = "any" | "10k" | "50k" | "100k";

/** As 4 faixas do protótipo mapeadas para o valor real de `minFollowers`. */
const MINF: Array<{ key: Tier; label: string; value: string; min: number }> = [
  { key: "any", label: "Sem mínimo", value: "", min: 0 },
  { key: "10k", label: "10 mil", value: "10000", min: 10000 },
  { key: "50k", label: "50 mil", value: "50000", min: 50000 },
  { key: "100k", label: "100 mil", value: "100000", min: 100000 },
];

const TIERTXT: Record<Tier, string> = {
  any: "Qualquer tamanho",
  "10k": "10 mil+ seguidores",
  "50k": "50 mil+ seguidores",
  "100k": "100 mil+ seguidores",
};

const CAP: Record<Tier, string> = {
  any: "Qualquer tamanho de perfil",
  "10k": "Microcriadores: engajados e acessíveis",
  "50k": "Criadores em ascensão. Já têm holofote",
  "100k": "Grandes nomes. Alcance máximo",
};

const TARGET_W: Record<Tier, number> = { any: 52, "10k": 64, "50k": 76, "100k": 90 };

/** Gêneros: valor aceito pela API -> rótulo do protótipo. */
const GENDERS = [
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
  { value: "preferNotToInform", label: "Prefiro não informar" },
  { value: "outros", label: "Outros" },
];

const TAG_ICON =
  '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>';

/** Ícones do protótipo, por nome de nicho normalizado (os nichos reais vêm da API). */
const NICON: Record<string, string> = {
  beleza:
    '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>',
  skincare:
    '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  moda: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  fitness:
    '<path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/>',
  "casa e decor":
    '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M4 18v2"/><path d="M20 18v2"/>',
  bebidas:
    '<path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5z"/>',
  gastronomia:
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  viagem:
    '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  tecnologia: '<rect width="12" height="20" x="6" y="2" rx="2"/><path d="M12 18h.01"/>',
  games:
    '<path d="M6 12h4"/><path d="M8 10v4"/><path d="M15 13h.01"/><path d="M18 11h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z"/>',
};

const normName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const splitCsv = (s: string | undefined) => (s ? s.split(",").filter(Boolean) : []);

function tierOf(minFollowers: string): Tier {
  const n = parseInt((minFollowers || "").replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return "any";
  if (n >= 100000) return "100k";
  if (n >= 50000) return "50k";
  if (n >= 10000) return "10k";
  return "any";
}

/* ===== Bonequinho ===== */

function Figure({
  gender,
  nicheIcon,
}: {
  gender: string | null;
  nicheIcon: string | null;
}) {
  const fem = gender === "female";
  return (
    <svg viewBox="0 -12 52 76" aria-hidden="true">
      {fem ? (
        <path
          className="hair"
          d="M12.5 19C12.5 5.5 37.5 5.5 37.5 19v13c0 2.6-2.6 3.6-5.5 2.8H18c-2.9.8-5.5-.2-5.5-2.8z"
        />
      ) : null}
      <path className="tor" d="M6 64C6 43 14 32 25 32s19 11 19 32z" />
      <circle className="head" cx="25" cy="19" r="10" />
      {gender === "male" ? (
        <path
          className="mst"
          d="M19.4 24.6c1.3-2.7 4-2.5 5.6-.9 1.6-1.6 4.3-1.8 5.6.9-1.8-.6-3.7-.1-5.6.9-1.9-1-3.8-1.5-5.6-.9z"
        />
      ) : null}
      {fem ? <path className="hair" d="M15 17.5C15 8.5 35 8.5 35 17.5c-5-3.4-15-3.4-20 0z" /> : null}
      {nicheIcon ? (
        <g className="bdg">
          <circle cx="40" cy="8" r="11" fill="#050505" stroke="#fff" strokeWidth="1.8" />
          <g
            transform="translate(32.6 .6) scale(.62)"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: nicheIcon }}
          />
        </g>
      ) : null}
    </svg>
  );
}

/* ===== Etapa ===== */

export function StepCreators({ formData, updateFormData, fieldErrors, tried }: WizardStepProps) {
  const { data: niches = [] } = useNiches();

  const n = Math.max(0, parseInt(formData.influencersCount, 10) || 0);
  const tier = tierOf(formData.minFollowers);
  const selectedMain = useMemo(() => splitCsv(formData.mainNiche), [formData.mainNiche]);
  const selectedSubs = useMemo(() => splitCsv(formData.subniches), [formData.subniches]);
  const selectedStates = useMemo(() => splitCsv(formData.state), [formData.state]);
  const selectedCities = useMemo(() => splitCsv(formData.city), [formData.city]);
  const gender = formData.gender && formData.gender !== "all" ? formData.gender : "";

  // "minSet": o usuário já escolheu uma faixa (inclusive "Sem mínimo").
  const [minSet, setMinSet] = useState(
    () =>
      !!formData.minFollowers ||
      !!formData.mainNiche ||
      !!formData.state ||
      (!!formData.gender && formData.gender !== "all"),
  );
  const [skipN, setSkipN] = useState(false);

  const r1 = n > 0;
  const r2 = r1 && minSet;
  const r3 = r2;

  // Cartões já revelados não repetem a animação `.rev` quando a etapa re-renderiza.
  const seen = useRef(new Set<string>());
  const rev = (k: string, active: boolean) => {
    if (!active) return "";
    const first = !seen.current.has(k);
    seen.current.add(k);
    return first ? "rev" : "";
  };

  /* --- nichos --- */
  const nicheById = useMemo(() => {
    const m = new Map<string, string>();
    niches.forEach((x) => m.set(getNicheIdKey(x), x.name));
    return m;
  }, [niches]);
  const rootOptions = useMemo(
    () =>
      niches
        .filter(isNicheRoot)
        .map((x) => ({ value: getNicheIdKey(x), label: x.name })),
    [niches],
  );
  const iconFor = (id: string) => NICON[normName(nicheById.get(id) ?? "")] ?? null;

  const toggleMain = (key: string) => {
    if (selectedMain.includes(key)) {
      const removedChildren = new Set(
        niches.filter((x) => isNicheChildOf(key, x)).map(getNicheIdKey),
      );
      const nextSubs = selectedSubs.filter((s) => !removedChildren.has(s));
      if (nextSubs.length !== selectedSubs.length) {
        updateFormData("subniches", nextSubs.join(","));
      }
      updateFormData("mainNiche", selectedMain.filter((v) => v !== key).join(","));
    } else {
      updateFormData("mainNiche", [...selectedMain, key].join(","));
    }
  };
  const toggleSub = (key: string) => {
    const next = selectedSubs.includes(key)
      ? selectedSubs.filter((s) => s !== key)
      : [...selectedSubs, key];
    updateFormData("subniches", next.join(","));
  };
  const clearNiches = () => {
    updateFormData("mainNiche", "");
    updateFormData("subniches", "");
  };

  /* --- localização --- */
  const stateOptions = useMemo(
    () => [
      { value: "", label: "Todo o Brasil" },
      ...BRAZILIAN_STATES.map((s) => ({ value: s.code, label: s.name })),
    ],
    [],
  );
  const stateValue = selectedStates.length === 1 ? selectedStates[0] : "";
  const multiStates = selectedStates.length > 1;
  const stateDropdownOptions = multiStates
    ? [{ value: "__multi", label: `${selectedStates.length} estados` }, ...stateOptions]
    : stateOptions;
  const onState = (v: string) => {
    if (v === "__multi") return;
    updateFormData("state", v);
    const kept = retainCitiesForStates(selectedCities, v ? [v] : []);
    if (kept.length !== selectedCities.length) updateFormData("city", kept.join(","));
  };
  const cityOptions = useMemo(
    () =>
      stateValue
        ? [
            { value: "", label: "Todas as cidades" },
            ...getCitiesByState(stateValue).map((c) => ({
              value: buildCityKey(c.name, c.state),
              label: c.name,
            })),
          ]
        : [],
    [stateValue],
  );
  const stateLabel =
    selectedStates.length === 0
      ? ""
      : selectedStates
          .map((c) => BRAZILIAN_STATES.find((s) => s.code === c)?.name ?? c)
          .join(", ");

  /* --- quantidade --- */
  const setCount = (next: number) => {
    const v = Math.max(0, Math.min(9999, next));
    updateFormData("influencersCount", v > 0 ? String(v) : "");
  };

  /* --- potencial: dado real do catálogo (mesmos filtros do formulário antigo) --- */
  const catalogFilters = useMemo(() => {
    const f: { gender?: string; followers_min?: number; state?: string; city?: string } = {};
    if (gender) f.gender = gender;
    const min = parseInt((formData.minFollowers || "").replace(/\D/g, ""), 10);
    if (min > 0) f.followers_min = min;
    if (selectedStates.length > 0) f.state = selectedStates[0];
    if (selectedCities.length > 0) {
      const name = parseCityKey(selectedCities[0])?.name;
      if (name) f.city = name;
    }
    return f;
  }, [gender, formData.minFollowers, selectedStates, selectedCities]);
  const { data: catalog, isError: catalogError } = useInfluencersCatalog(catalogFilters);
  const realPot =
    catalog?.stats != null ? catalog.stats.influencer_count : catalog?.items?.length;
  // Sem dado do catálogo (erro/indisponível) cai numa estimativa só visual.
  const estimate = useMemo(() => {
    let x = 1840;
    x *= { any: 1, "10k": 0.7, "50k": 0.35, "100k": 0.15 }[tier];
    if (selectedStates.length) x *= 0.22;
    if (gender) x *= 0.5;
    return Math.round(x);
  }, [tier, selectedStates.length, gender]);
  const potTarget = typeof realPot === "number" ? realPot : catalogError ? estimate : 0;
  const isEstimate = typeof realPot !== "number" && catalogError;

  const [potShown, setPotShown] = useState(0);
  const potRef = useRef(0);
  useEffect(() => {
    const from = potRef.current;
    const to = potTarget;
    if (from === to) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 650);
      const e = 1 - Math.pow(1 - k, 3);
      const v = Math.round(from + (to - from) * e);
      potRef.current = v;
      setPotShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [potTarget]);

  /* --- palco --- */
  const show = Math.min(n, FMAX);
  const stageTier: Tier = minSet ? tier : "10k";
  const fw = useMemo(() => {
    const sh = show || 1;
    let w = TARGET_W[minSet ? tier : "any"];
    for (; w > 30; w -= 2) {
      const per = Math.max(1, Math.floor(560 / (w * 0.84)));
      if (Math.ceil(sh / per) * w * 1.13 + w * 0.22 <= 130) break;
    }
    return w;
  }, [show, tier, minSet]);

  const figGender = gender || null;
  const figNiche = (i: number): string | null => {
    if (!selectedMain.length) return null;
    return iconFor(selectedMain[i % selectedMain.length]) ?? TAG_ICON;
  };

  const countErr = (tried && n <= 0) || fieldErrors.has("influencersCount");
  const sum = n
    ? `${n} ${n === 1 ? "influenciador" : "influenciadores"}${minSet ? " · " + TIERTXT[tier] : ""}`
    : "";

  return (
    <>
      <div className="nstage-slot">
        <div
          className={`nstage t-${stageTier} ${n ? "has" : ""} ${countErr ? "err" : ""}`.trim()}
          id="nstage"
          style={{ ["--fw" as string]: `${fw}px` }}
        >
          <div className="nst-top">
            <span className="nst-sum" id="nsts">
              {sum}
            </span>
            <span
              className="nst-pot"
              title={
                isEstimate
                  ? "Estimativa visual: não foi possível consultar a base de criadores"
                  : "Criadores da base que atendem a seguidores, localização e gênero"
              }
            >
              <small>{isEstimate ? "Potencial na base (estimativa)" : "Potencial na base"}</small>
              <b id="npot">{potShown.toLocaleString("pt-BR")}</b>
            </span>
          </div>
          <div className="nst-row">
            <div className="fgs" id="fgs">
              {Array.from({ length: show }, (_, i) => (
                <span key={i} className="fg pop" style={{ ["--i" as string]: i }}>
                  <Figure gender={figGender} nicheIcon={figNiche(i)} />
                </span>
              ))}
            </div>
            {n > FMAX ? <span className="nst-more">+{n - FMAX}</span> : null}
            <div className="nst-ghost" id="nsg" style={{ display: n ? "none" : "block" }}>
              <svg viewBox="0 -12 52 76" aria-hidden="true">
                <path className="tor" d="M6 64C6 43 14 32 25 32s19 11 19 32z" />
                <circle className="head" cx="25" cy="19" r="10" />
              </svg>
            </div>
            <button
              type="button"
              className="nst-add"
              aria-label="Adicionar influenciador"
              onClick={() => setCount(n + 1)}
            >
              <I n="plus" />
            </button>
          </div>
          <span
            className="nst-loc"
            id="nstl"
            style={{ display: stateLabel ? "inline-flex" : "none" }}
          >
            {stateLabel ? (
              <>
                <I n="flag" cls="sm" />
                {stateLabel}
              </>
            ) : null}
          </span>
        </div>
      </div>

      <div className="n2flow">
        <div className="nst-ctl">
          <div className="nst-st">
            <button type="button" aria-label="Menos" onClick={() => setCount(n - 1)}>
              −
            </button>
            <input
              inputMode="numeric"
              id="campaign-influencers-count"
              placeholder="0"
              aria-label="Quantidade de influenciadores"
              value={n || ""}
              onChange={(e) => setCount(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
            />
            <button type="button" aria-label="Mais" onClick={() => setCount(n + 1)}>
              +
            </button>
          </div>
          <div className="nst-q">
            {[5, 10, 20].map((v) => (
              <button key={v} type="button" onClick={() => setCount(n + v)}>
                +{v}
              </button>
            ))}
          </div>
          <FieldError show={countErr}>Adicione ao menos um influenciador</FieldError>
        </div>

        {r1 ? (
          <SectionCard
            icon={<I n="trend" cls="sm" />}
            title="Seguidores mínimos"
            sub="Quanto maior o perfil, mais holofote"
            className={rev("f", r1)}
          >
            <div className="nseg">
              {MINF.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={minSet && tier === m.key ? "on" : ""}
                  onClick={() => {
                    setMinSet(true);
                    updateFormData("minFollowers", m.value);
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="ncap">{minSet ? CAP[tier] : "Escolha o tamanho mínimo dos perfis"}</p>
          </SectionCard>
        ) : null}

        {r2 ? (
          <SectionCard
            icon={<I n="sparkles" cls="sm" />}
            title="Nichos"
            sub="Cada nicho dá um estilo ao seu time"
            className={`wide ${rev("n", r2)}`.trim()}
            right={
              selectedMain.length ? (
                <button type="button" className="n2clr" onClick={clearNiches}>
                  {selectedMain.length} selecionado{selectedMain.length > 1 ? "s" : ""} · Limpar
                </button>
              ) : skipN ? null : (
                <button type="button" className="n2clr" onClick={() => setSkipN(true)}>
                  Pular
                </button>
              )
            }
          >
            <Chips
              options={rootOptions}
              selected={selectedMain}
              onToggle={toggleMain}
              icon={(v) => {
                const p = iconFor(v);
                return p ? (
                  <span className="nci">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: p }}
                    />
                  </span>
                ) : null;
              }}
            />
            {selectedMain.map((parentKey) => {
              const children = niches.filter((x) => isNicheChildOf(parentKey, x));
              if (!children.length) return null;
              return (
                <div key={parentKey} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p className="ncap">Subnichos de {nicheById.get(parentKey)}</p>
                  <Chips
                    options={children.map((c) => ({ value: getNicheIdKey(c), label: c.name }))}
                    selected={selectedSubs}
                    onToggle={toggleSub}
                  />
                </div>
              );
            })}
          </SectionCard>
        ) : null}

        {r3 ? (
          <div className={`n2grid ${rev("l", r3)}`.trim()}>
            <SectionCard
              icon={<I n="flag" cls="sm" />}
              title="Localização"
              sub="Onde os criadores moram"
            >
              <Dropdown
                value={multiStates ? "__multi" : stateValue}
                options={stateDropdownOptions}
                onChange={onState}
                placeholder="Todo o Brasil"
              />
              {stateValue ? (
                <Dropdown
                  value={selectedCities[0] ?? ""}
                  options={cityOptions}
                  onChange={(v) => updateFormData("city", v)}
                  placeholder="Todas as cidades"
                />
              ) : null}
            </SectionCard>
            <SectionCard
              icon={<I n="user" cls="sm" />}
              title="Gênero"
              sub="Opcional. Muda o visual do time"
            >
              <Chips
                multi={false}
                options={GENDERS}
                selected={gender}
                onToggle={(v) => updateFormData("gender", v === gender ? "all" : v)}
              />
            </SectionCard>
          </div>
        ) : null}
      </div>
    </>
  );
}
