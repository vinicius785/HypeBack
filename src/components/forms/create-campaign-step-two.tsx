import { useState, useMemo, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import type { CampaignFormData } from "@/shared/types";
import {
  BRAZILIAN_STATES,
  buildCityKey,
  getCitiesByState,
  parseCityKey,
  retainCitiesForStates,
} from "@/shared/data/brazilian-states-cities";
import { handleNumberInput } from "@/shared/utils/masks";
import { useInfluencersCatalog } from "@/hooks/use-catalog";
import { useNiches } from "@/hooks/use-niches";
import {
  getNicheIdKey,
  isNicheChildOf,
  isNicheRoot,
} from "@/shared/utils/niche-tree";

interface CreateCampaignStepTwoProps {
  formData: CampaignFormData;
  updateFormData: (field: keyof CampaignFormData, value: string) => void;
  onBack: () => void;
  onNext: () => void;
  /** Quando true, o rodapé global da página mostra Voltar (ex.: fluxo /campaigns/new) */
  hideBackButton?: boolean;
  fieldErrors?: Set<string>;
}

/** Toggle no estilo Figma: 37×20px, pill, verde (on) / cinza (off), knob cinza escuro */
function ToggleSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  const trackWidth = 37;
  const trackHeight = 20;
  const knobSize = 16;
  const knobOffset = (trackHeight - knobSize) / 2; // 2px
  const travel = trackWidth - knobSize - knobOffset * 2; // 17px

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className="relative shrink-0 cursor-pointer rounded-[1.667px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      style={{
        width: trackWidth,
        height: trackHeight,
        borderRadius: trackHeight / 2,
      }}
    >
      {/* Track – verde quando ligado, cinza quando desligado */}
      <span
        className="absolute inset-0 rounded-full transition-colors duration-200"
        style={{
          backgroundColor: checked ? "var(--color-success-500)" : "#d4d4d4",
          borderRadius: trackHeight / 2,
        }}
      />
      {/* Knob – cinza escuro (quase preto), desliza da esquerda para a direita */}
      <span
        className="pointer-events-none absolute rounded-full transition-transform duration-200 ease-out"
        style={{
          width: knobSize,
          height: knobSize,
          top: knobOffset,
          left: knobOffset,
          backgroundColor: "#262626",
          transform: checked ? `translateX(${travel}px)` : "translateX(0)",
        }}
      />
    </button>
  );
}

export function CreateCampaignStepTwo({
  formData,
  updateFormData,
  onBack,
  onNext,
  hideBackButton = false,
  fieldErrors,
}: CreateCampaignStepTwoProps) {
  const [selectedStates, setSelectedStates] = useState<string[]>(
    formData.state ? formData.state.split(",").filter(Boolean) : []
  );
  const [segmentFollowers, setSegmentFollowers] = useState(
    !!formData.minFollowers && formData.minFollowers.replace(/\D/g, "") !== ""
  );
  const [segmentLocation, setSegmentLocation] = useState(
    !!(formData.state || formData.city)
  );
  const [segmentGender, setSegmentGender] = useState(
    !!formData.gender && formData.gender !== "all"
  );

  const { data: niches = [] } = useNiches();

  const influencersError = fieldErrors?.has("influencersCount");

  useEffect(() => {
    if (!influencersError) return;
    const el = document.getElementById("campaign-influencers-count");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLInputElement).focus();
  }, [fieldErrors]);

  useEffect(() => {
    if (formData.state) {
      const states = formData.state.split(",").filter(Boolean);
      setSelectedStates(states);
    } else {
      setSelectedStates([]);
    }
  }, [formData.state]);

  useEffect(() => {
    if (!segmentFollowers) {
      updateFormData("minFollowers", "");
    }
  }, [segmentFollowers, updateFormData]);

  useEffect(() => {
    if (!segmentLocation) {
      updateFormData("state", "");
      updateFormData("city", "");
      setSelectedStates([]);
    }
  }, [segmentLocation, updateFormData]);

  useEffect(() => {
    if (!segmentGender && formData.gender !== "all") {
      updateFormData("gender", "all");
    }
  }, [segmentGender, formData.gender, updateFormData]);

  const stateOptions = BRAZILIAN_STATES.map((state) => ({
    value: state.code,
    label: state.name,
  }));

  const cityOptions = useMemo(() => {
    if (selectedStates.length === 0) {
      return [];
    }
    const cities: Array<{ value: string; label: string }> = [];
    selectedStates.forEach((stateCode) => {
      const citiesInState = getCitiesByState(stateCode);
      citiesInState.forEach((city) => {
        cities.push({
          value: buildCityKey(city.name, city.state),
          label: `${city.name} - ${city.state}`,
        });
      });
    });
    return cities;
  }, [selectedStates]);

  const selectedCities = useMemo(() => {
    return formData.city ? formData.city.split(",").filter(Boolean) : [];
  }, [formData.city]);

  const mainNicheOptions = useMemo(
    () =>
      niches
        .filter(isNicheRoot)
        .map((n) => ({ value: getNicheIdKey(n), label: n.name })),
    [niches],
  );

  const selectedMainNiches = useMemo(
    () => (formData.mainNiche ? formData.mainNiche.split(",").filter(Boolean) : []),
    [formData.mainNiche],
  );

  const selectedSubniches = useMemo(
    () => (formData.subniches ? formData.subniches.split(",").filter(Boolean) : []),
    [formData.subniches],
  );

  const handleStateChange = (values: string[]) => {
    setSelectedStates(values);
    updateFormData("state", values.join(","));
    // Preserva as cidades dos estados que continuam selecionados — antes,
    // incluir um segundo estado limpava tudo o que já tinha sido escolhido.
    const keptCities = retainCitiesForStates(selectedCities, values);
    if (keptCities.length !== selectedCities.length) {
      updateFormData("city", keptCities.join(","));
    }
  };

  const handleCityChange = (values: string[]) => {
    updateFormData("city", values.join(","));
  };

  const catalogFilters = useMemo(() => {
    const filters: {
      gender?: string;
      followers_min?: number;
      state?: string;
      city?: string;
    } = {};
    if (segmentGender && formData.gender && formData.gender !== "all") {
      filters.gender = formData.gender;
    }
    if (segmentFollowers && formData.minFollowers) {
      const min = parseInt(formData.minFollowers.replace(/\D/g, ""), 10);
      if (!isNaN(min) && min > 0) filters.followers_min = min;
    }
    if (segmentLocation && selectedStates.length > 0) {
      filters.state = selectedStates[0];
    }
    if (segmentLocation && selectedCities.length > 0) {
      // Nome pode ter hífen ("Biritiba-Mirim-SP"): parse pela UF no fim.
      const firstCity = parseCityKey(selectedCities[0])?.name;
      if (firstCity) filters.city = firstCity;
    }
    return filters;
  }, [
    formData.gender,
    formData.minFollowers,
    segmentGender,
    segmentFollowers,
    segmentLocation,
    selectedStates,
    selectedCities,
  ]);

  const hasFilters = useMemo(
    () =>
      (segmentGender && formData.gender && formData.gender !== "all") ||
      (segmentFollowers &&
        !!formData.minFollowers &&
        parseInt(formData.minFollowers.replace(/\D/g, ""), 10) > 0) ||
      (segmentLocation && selectedStates.length > 0) ||
      (segmentLocation && selectedCities.length > 0),
    [
      segmentGender,
      segmentFollowers,
      segmentLocation,
      formData.gender,
      formData.minFollowers,
      selectedStates.length,
      selectedCities.length,
    ]
  );

  const { data: catalogData, isLoading: isLoadingInfluencers } =
    useInfluencersCatalog(hasFilters ? catalogFilters : undefined);

  const influencers = catalogData?.items ?? [];

  const influencerCount =
    catalogData?.stats != null
      ? catalogData.stats.influencer_count
      : influencers.length;

  const totalFollowers = useMemo(() => {
    const fromStats = catalogData?.stats?.total_followers;
    if (typeof fromStats === "number") return fromStats;
    return influencers.reduce((sum, inf) => sum + (inf.followers || 0), 0);
  }, [catalogData?.stats?.total_followers, influencers]);

  const formatNumber = (num: number): string =>
    num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const inputClass =
    "w-full rounded-[24px] bg-[#F5F5F5] px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none";
  const labelClass = "text-base font-medium leading-5 text-[#0A0A0A]";

  return (
    <form
      className="flex flex-col gap-11"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      {/* Header – Figma */}
      <div className="flex flex-col gap-4">
        <h2 className="text-[28px] font-medium leading-8 text-[#0A0A0A]">
          Perfil dos influenciadores
        </h2>
        <p className="text-lg leading-8 text-[#404040]">
          Defina o perfil mínimo dos influenciadores para esta campanha. Segmentação
          por seguidores, localização e gênero é opcional.
        </p>
      </div>

      {/* Card 1: Quantos influenciadores + segmentar seguidores */}
      <div className="flex flex-col gap-4 rounded-[12px] bg-[#FAFAFA] p-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="campaign-influencers-count" className={labelClass}>
            Quantos influenciadores?
            <span className="text-red-500 ml-1" aria-hidden>*</span>
          </label>
          <input
            id="campaign-influencers-count"
            type="text"
            inputMode="numeric"
            placeholder="Ex.: 10"
            value={formData.influencersCount}
            onChange={(e) =>
              handleNumberInput(e, (value) =>
                updateFormData("influencersCount", value)
              )
            }
            className={influencersError
              ? "w-full rounded-[24px] bg-red-50 border border-red-400 px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none transition-colors"
              : inputClass}
          />
          {influencersError && (
            <p className="flex items-center gap-1 text-sm text-red-500 mt-0.5">
              <Icon name="CircleAlert" size={14} color="currentColor" />
              Campo obrigatório
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-1 items-center gap-6 rounded-[12px] bg-[#F5F5F5] px-4 py-3 min-h-[68px]">
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-lg font-medium text-black">
                Deseja segmentar seguidores?{" "}
                <span className="font-normal text-[#626262]">(opcional)</span>
              </p>
              <p className="text-base text-[#626262]">
                Ative para filtrar influenciadores com base em seus seguidores
              </p>
            </div>
            <ToggleSwitch
              checked={segmentFollowers}
              onCheckedChange={setSegmentFollowers}
            />
          </div>

          {segmentFollowers && (
            <div className="flex flex-col gap-1">
              <label className={labelClass}>
                Quantidade mínima de seguidores (opcional)
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ex: 1000"
                value={formData.minFollowers}
                onChange={(e) =>
                  handleNumberInput(e, (value) =>
                    updateFormData("minFollowers", value)
                  )
                }
                className={inputClass}
              />
            </div>
          )}

          {segmentFollowers && (
            <div className="flex items-center gap-1">
              <Icon name="Lightbulb" size={24} color="#626262" />
              <p className="text-base text-[#626262]">
                Influenciadores com menos seguidores não serão considerados
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Card 2: Segmento de conteúdo – Nicho + Subnicho */}
      <div className="flex flex-col gap-6 rounded-[12px] bg-[#FAFAFA] p-6">
        <div className="flex flex-col gap-0">
          <h3 className="text-2xl font-medium leading-8 text-[#0A0A0A]">
            Segmento de conteúdo
          </h3>
          <p className="text-base leading-8 text-[#404040]">
            Ajuda a encontrar perfis alinhados ao tipo de conteúdo que a
            campanha precisa.
          </p>
        </div>

        {/* Nichos pai */}
        <MultiSelect
          label="Nicho principal"
          placeholder="Selecione um ou mais nichos"
          options={mainNicheOptions}
          value={selectedMainNiches}
          onChange={(values) => {
            // remove subnichos de pais que foram desmarcados
            const removed = selectedMainNiches.filter((v) => !values.includes(v));
            if (removed.length > 0) {
              const removedChildKeys = new Set(
                removed.flatMap((parentKey) =>
                  niches
                    .filter((n) => isNicheChildOf(parentKey, n))
                    .map(getNicheIdKey),
                ),
              );
              const nextSubs = selectedSubniches.filter(
                (s) => !removedChildKeys.has(s),
              );
              updateFormData("subniches", nextSubs.join(","));
            }
            updateFormData("mainNiche", values.join(","));
          }}
          isSearchable
        />

        {/* Subnichos por pai selecionado */}
        {selectedMainNiches.map((parentKey) => {
          const parent = niches.find((n) => getNicheIdKey(n) === parentKey);
          const children = niches.filter((n) => isNicheChildOf(parentKey, n));
          if (children.length === 0) return null;
          return (
            <div
              key={parentKey}
              className="flex flex-col gap-3 border-l-2 border-[#E5E5E5] pl-4"
            >
              <p className="text-sm font-medium text-[#626262]">
                Subnichos de{" "}
                <span className="text-[#0A0A0A]">{parent?.name}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {children.map((child) => {
                  const key = getNicheIdKey(child);
                  const isSelected = selectedSubniches.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const next = isSelected
                          ? selectedSubniches.filter((s) => s !== key)
                          : [...selectedSubniches, key];
                        updateFormData("subniches", next.join(","));
                      }}
                      className={[
                        "rounded-full px-4 py-1.5 text-sm transition-colors",
                        isSelected
                          ? "bg-[#0A0A0A]/10 text-[#0A0A0A] ring-1 ring-[#0A0A0A]/20"
                          : "bg-[#F5F5F5] text-[#404040] hover:bg-[#E5E5E5]",
                      ].join(" ")}
                    >
                      {child.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Card 3: Localização */}
      <div className="flex flex-col gap-7 rounded-[12px] bg-[#FAFAFA] p-6">
        <div className="flex items-center gap-6 rounded-[12px] bg-[#F5F5F5] px-4 py-3 min-h-[68px]">
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-lg font-medium text-black">
              Localização <span className="font-normal text-[#626262]">(opcional)</span>
            </p>
            <p className="text-base text-[#404040]">
              Defina onde os influenciadores devem estar. A cidade depende do
              estado
            </p>
          </div>
          <ToggleSwitch
            checked={segmentLocation}
            onCheckedChange={setSegmentLocation}
          />
        </div>
        {segmentLocation && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <MultiSelect
                label="Estado"
                placeholder="Selecione o/os estado(s) desejado(s)"
                options={stateOptions}
                value={selectedStates}
                onChange={handleStateChange}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <MultiSelect
                label="Cidade"
                placeholder={
                  selectedStates.length === 0
                    ? "Selecione primeiro um ou mais estados"
                    : "Selecione a/as cidade(s) desejada(s)"
                }
                options={cityOptions}
                value={selectedCities}
                onChange={handleCityChange}
                disabled={selectedStates.length === 0}
              />
            </div>
          </div>
        )}
      </div>

      {/* Card 4: Segmentar por gênero */}
      <div className="flex flex-col gap-7 rounded-[12px] bg-[#FAFAFA] p-6">
        <div className="flex items-center gap-6 rounded-[16px] bg-[#F5F5F5] px-4 py-3 min-h-[68px]">
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-lg font-medium text-black">
              Segmentar por gênero{" "}
              <span className="font-normal text-[#626262]">(opcional)</span>
            </p>
            <p className="text-base text-[#404040]">
              Selecione o gênero do influenciador aceito para a campanha
            </p>
          </div>
          <ToggleSwitch
            checked={segmentGender}
            onCheckedChange={(checked) => {
              setSegmentGender(checked);
              if (!checked) {
                updateFormData("gender", "all");
              }
            }}
          />
        </div>
        {segmentGender && (
          <div className="max-w-full">
            <Select
              label="Gênero"
              placeholder="Selecione o/os gênero(s)"
              value={formData.gender}
              onChange={(value) => updateFormData("gender", value)}
              openUp
              options={[
                { label: "Masculino", value: "male" },
                { label: "Feminino", value: "female" },
                { label: "Prefiro não informar", value: "preferNotToInform" },
                { label: "Outros", value: "outros" },
              ]}
            />
          </div>
        )}
      </div>

      {/* Contador de influenciadores (quando há filtros) */}
      {hasFilters && (
        <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4">
          <div className="flex items-center justify-between">
            {isLoadingInfluencers ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-b-transparent" />
            ) : (
              <p className="text-xs text-primary-700">
                Com esta segmentação você terá um potencial de{" "}
                <span className="font-bold text-primary-900">
                  {influencerCount}
                </span>{" "}
                influenciadores. Com um público total de{" "}
                <span className="font-bold text-primary-900">
                  {formatNumber(totalFollowers)}
                </span>{" "}
                de seguidores
              </p>
            )}
          </div>
        </div>
      )}

      {!hideBackButton && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onBack} className="w-min">
            <div className="flex items-center justify-center gap-2">
              <Icon name="ArrowLeft" size={16} color="#404040" />
              <p className="font-semibold text-neutral-700">Voltar</p>
            </div>
          </Button>
        </div>
      )}
    </form>
  );
}
