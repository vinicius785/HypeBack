import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { clsx } from "clsx";
import { useState } from "react";

import { CampaignInviteAcceptModal } from "@/components/campaign-invite-accept-modal";
import { CampaignInviteDeclineModal } from "@/components/campaign-invite-decline-modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { usePublicCampaignInvite } from "@/hooks/use-public-campaign-invite";
import { getUploadUrl } from "@/lib/utils/api";
import type { PublicCampaignInviteData } from "@/shared/services/public-campaign-invite";
import { formatReais } from "@/shared/utils/masks";
import { formatContentTypeLabel } from "@/shared/utils/social-profile-url";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import {
  getCampaignStatusDisplayLabel,
  getCampaignStatusValue,
} from "@/shared/utils/campaign-status";

export const Route = createFileRoute("/(public)/campaigns/$campaignId/invite")({
  component: PublicCampaignInviteScreen,
});

const linkOutlineClass =
  "inline-flex items-center justify-center min-h-11 px-8 rounded-full font-semibold text-sm bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700 transition-colors w-full sm:w-auto text-center";

function paymentMethodLabel(pm?: string): string {
  if (!pm) return "";
  const key = pm.toLowerCase();
  const map: Record<string, string> = {
    fixed: "Pagamento fixo por influenciador",
    swap: "Permuta",
    cpa: "CPA (por ação)",
    cpm: "CPM",
  };
  return map[key] ?? pm;
}

function formatInvitePhaseDate(iso?: string): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function hasRemunerationBlock(data: PublicCampaignInviteData): boolean {
  return Boolean(
    data.payment_method ||
    data.payment_method_details?.description?.trim() ||
    (data.payment_method_details?.amount != null &&
      Number.isFinite(data.payment_method_details.amount)),
  );
}

function NicheListModal({ title, names, onClose }: { title: string; names: string[]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <Icon name="X" size={20} color="#525252" />
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {names.map((name, i) => (
            <li key={i} className="text-base text-neutral-950 py-1 border-b border-neutral-100 last:border-b-0">
              {name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PublicCampaignInviteScreen() {
  const { campaignId } = useParams({
    from: "/(public)/campaigns/$campaignId/invite",
  });

  const { data, isLoading, isError, error } = usePublicCampaignInvite(campaignId);

  const [inviteDeclined, setInviteDeclined] = useState(false);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [nicheModalOpen, setNicheModalOpen] = useState(false);
  const [secondaryNicheModalOpen, setSecondaryNicheModalOpen] = useState(false);

  const MAX_NICHES_INVITE = 3;

  const handleAccept = () => {
    setAcceptModalOpen(true);
  };

  const handleDeclineClick = () => {
    setDeclineModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-52 w-full rounded-xl" />
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="skeleton h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    const is404 = (error as { status?: number })?.status === 404;
    return (
      <div className="w-full max-w-md mx-auto px-4 py-16 text-center flex flex-col gap-4">
        <Icon name="Info" size={40} color="#737373" className="mx-auto" />
        <p className="text-neutral-700">
          {is404
            ? "Este convite não está disponível ou a campanha não foi encontrada."
            : (error as Error)?.message || "Não foi possível carregar os dados da campanha."}
        </p>
        <Link to="/sign-in" className={clsx(linkOutlineClass, "mx-auto")}>
          Entrar no backoffice
        </Link>
      </div>
    );
  }

  const bannerSrc = data.banner ? getUploadUrl(data.banner) ?? undefined : undefined;
  const statusValue = getCampaignStatusValue(data.status);
  const showRemuneration = hasRemunerationBlock(data);
  const networks = data.allowed_social_networks ?? [];
  const phases = data.phases ?? [];
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 sm:py-10 pb-16 flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-primary-600 tracking-tight">Hypeapp</p>
        <Link
          to="/sign-in"
          className="inline-flex items-center justify-center min-h-9 px-4 rounded-full text-sm font-medium bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700"
        >
          Área da marca
        </Link>
      </header>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="relative h-[220px] sm:h-[260px] w-full bg-neutral-200">
          {bannerSrc ? (
            <img
              src={bannerSrc}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
              Campanha
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
            {data.status ? (
              <span
                className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${statusValue === "published"
                  ? "bg-emerald-500/90 text-white"
                  : "bg-white/90 text-neutral-950"
                  }`}
              >
                {getCampaignStatusDisplayLabel(data.status)}
              </span>
            ) : null}
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white drop-shadow-sm leading-tight">
              {data.title}
            </h1>
          </div>
        </div>

        <div className="p-6 sm:p-8 flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-neutral-950">Sobre a campanha</h2>
            <p className="text-base text-neutral-600 leading-relaxed whitespace-pre-wrap">
              {data.description.trim() ||
                "Detalhes desta ação serão divulgados pela marca ou pelo aplicativo Hypeapp."}
            </p>
          </section>

          {data.objective?.trim() ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-neutral-950">Objetivo</h2>
              <p className="text-base text-neutral-600 leading-relaxed whitespace-pre-wrap">
                {data.objective}
              </p>
            </section>
          ) : null}

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.max_influencers != null && data.max_influencers > 0 ? (
              <div className="flex items-start gap-3 rounded-xl bg-neutral-50 border border-neutral-100 p-4">
                <div className="size-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                  <Icon name="Users" size={20} color="#525252" />
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Vagas
                  </p>
                  <p className="text-base font-semibold text-neutral-950">
                    Até {data.max_influencers} influenciadores
                  </p>
                </div>
              </div>
            ) : null}
            {data.segment_min_followers != null && data.segment_min_followers > 0 ? (
              <div className="flex items-start gap-3 rounded-xl bg-neutral-50 border border-neutral-100 p-4">
                <div className="size-10 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                  <Icon name="Eye" size={20} color="#525252" />
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Seguidores mínimos
                  </p>
                  <p className="text-base font-semibold text-neutral-950">
                    {data.segment_min_followers.toLocaleString("pt-BR")}+
                  </p>
                </div>
              </div>
            ) : null}
            {data.niches && data.niches.length > 0 ? (
              <div className="flex items-start gap-3 rounded-xl bg-neutral-50 border border-neutral-100 p-4 sm:col-span-2">
                <div className="size-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Icon name="Tag" size={20} color="#525252" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                    Nichos
                  </p>
                  <p className="text-base font-semibold text-neutral-950">
                    {data.niches.slice(0, MAX_NICHES_INVITE).join(", ")}
                    {data.niches.length > MAX_NICHES_INVITE && (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() => setNicheModalOpen(true)}
                          className="text-sm font-medium text-amber-700 underline"
                        >
                          ver mais ({data.niches.length})
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
            ) : null}

            {data.secondary_niche_names && data.secondary_niche_names.length > 0 ? (
              <div className="flex items-start gap-3 rounded-xl bg-neutral-50 border border-neutral-100 p-4 sm:col-span-2">
                <div className="size-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Icon name="Tag" size={20} color="#525252" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                    Subnichos
                  </p>
                  <p className="text-base font-semibold text-neutral-950">
                    {data.secondary_niche_names.slice(0, MAX_NICHES_INVITE).join(", ")}
                    {data.secondary_niche_names.length > MAX_NICHES_INVITE && (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() => setSecondaryNicheModalOpen(true)}
                          className="text-sm font-medium text-amber-700 underline"
                        >
                          ver mais ({data.secondary_niche_names.length})
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
            ) : null}
            {data.image_rights_period != null && data.image_rights_period > 0 ? (
              <div className="flex items-start gap-3 rounded-xl bg-neutral-50 border border-neutral-100 p-4 sm:col-span-2">
                <div className="size-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                  <Icon name="Image" size={20} color="#525252" />
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Uso de imagem
                  </p>
                  <p className="text-base font-semibold text-neutral-950">
                    Direitos de imagem: {data.image_rights_period} meses
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          {showRemuneration ? (
            <section className="flex flex-col gap-4 rounded-xl border border-neutral-100 bg-neutral-50/80 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <Icon name="Wallet" size={20} color="#525252" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-950">Remuneração</h2>
              </div>
              {data.payment_method ? (
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                    Forma de remuneração
                  </p>
                  <p className="text-base font-semibold text-neutral-950">
                    {paymentMethodLabel(data.payment_method)}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                  Detalhes
                </p>
                <div className="text-base text-neutral-700 space-y-2 leading-relaxed">
                  {data.payment_method_details?.description?.trim() ? (
                    <p className="whitespace-pre-wrap">{data.payment_method_details.description}</p>
                  ) : null}
                  {data.payment_method === "fixed" &&
                    data.payment_method_details?.amount != null &&
                    Number.isFinite(data.payment_method_details.amount) ? (
                    <p className="font-medium text-neutral-950">
                      Valor: {formatReais(data.payment_method_details.amount)}
                      {data.payment_method_details.currency
                        ? ` (${data.payment_method_details.currency})`
                        : ""}
                    </p>
                  ) : null}
                  {data.payment_method === "cpm" &&
                    data.payment_method_details?.amount != null &&
                    Number.isFinite(data.payment_method_details.amount) ? (
                    <p className="font-medium text-neutral-950">
                      CPM: {formatReais(data.payment_method_details.amount)}
                    </p>
                  ) : null}
                  {!data.payment_method_details?.description?.trim() &&
                    data.payment_method !== "fixed" &&
                    data.payment_method !== "cpm" &&
                    (data.payment_method === "swap" || data.payment_method === "cpa") ? (
                    <p className="text-neutral-600">
                      Os valores e condições específicos podem constar na descrição acima ou serão
                      alinhados com a marca após a aprovação.
                    </p>
                  ) : null}
                  {!data.payment_method_details?.description?.trim() &&
                    data.payment_method !== "fixed" &&
                    data.payment_method !== "cpm" &&
                    data.payment_method !== "swap" &&
                    data.payment_method !== "cpa" ? (
                    <p className="text-neutral-600 text-sm">
                      Consulte a marca ou o app para o detalhamento completo desta forma de
                      pagamento.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {networks.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                  <Icon name="Share2" size={20} color="#525252" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-950">Redes sociais da campanha</h2>
              </div>
              <p className="text-sm text-neutral-600">
                Esta ação aceita conteúdo publicado nas seguintes redes. Ao aceitar o convite, você
                informará o link do seu perfil em cada uma delas.
              </p>
              <ul className="flex flex-wrap gap-2">
                {networks.map((n) => (
                  <li
                    key={n}
                    className="inline-flex items-center rounded-full bg-neutral-100 border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-900"
                  >
                    {getNetworkLabel(n, n)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {phases.length > 0 ? (
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                  <Icon name="CalendarDays" size={20} color="#525252" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-950">Fases e entregas</h2>
              </div>
              <p className="text-sm text-neutral-600">
                Etapas previstas da campanha, com prazos e formatos por rede.
              </p>
              <ol className="flex flex-col gap-4 list-none p-0 m-0">
                {phases
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((phase, idx) => (
                    <li
                      key={`${phase.order}-${idx}`}
                      className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-baseline gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                          Fase {phase.order}
                        </span>
                        {phase.post_date ? (
                          <span className="text-sm text-neutral-600">
                            · Publicação: {formatInvitePhaseDate(phase.post_date)}
                          </span>
                        ) : null}
                        {phase.publish_time ? (
                          <span className="text-sm text-neutral-600">às {phase.publish_time}</span>
                        ) : null}
                      </div>
                      <p className="text-base font-medium text-neutral-950 mb-3">{phase.objective}</p>
                      {phase.formats.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                            Etapas / formatos
                          </p>
                          <ul className="space-y-2 text-sm text-neutral-700">
                            {phase.formats.map((f, i) => (
                              <li key={`${f.network}-${f.content_type}-${i}`} className="flex flex-wrap gap-x-2 gap-y-0.5">
                                <span className="font-medium text-neutral-950">
                                  {getNetworkLabel(f.network, f.network)}
                                </span>
                                {f.content_type ? (
                                  <>
                                    <span className="text-neutral-400">·</span>
                                    <span>
                                      {formatContentTypeLabel(f.network, f.content_type)}
                                    </span>
                                  </>
                                ) : null}
                                {f.quantity != null && f.quantity > 0 ? (
                                  <>
                                    <span className="text-neutral-400">·</span>
                                    <span>
                                      {f.quantity}{" "}
                                      {f.quantity === 1 ? "entrega" : "entregas"}
                                    </span>
                                  </>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-500">Formatos serão detalhados no app.</p>
                      )}
                    </li>
                  ))}
              </ol>
            </section>
          ) : null}

          {data.benefits?.length ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-neutral-950">Benefícios</h2>
              <ul className="list-disc pl-5 space-y-2 text-neutral-600">
                {data.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.rules_does?.length ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-neutral-950">O que a campanha espera</h2>
              <ul className="list-disc pl-5 space-y-2 text-neutral-600">
                {data.rules_does.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.rules_does_not?.length ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-neutral-950">Evitar</h2>
              <ul className="list-disc pl-5 space-y-2 text-neutral-600">
                {data.rules_does_not.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {nicheModalOpen && data.niches && (
            <NicheListModal
              title="Todos os nichos"
              names={data.niches}
              onClose={() => setNicheModalOpen(false)}
            />
          )}

          {secondaryNicheModalOpen && data.secondary_niche_names && (
            <NicheListModal
              title="Todos os subnichos"
              names={data.secondary_niche_names}
              onClose={() => setSecondaryNicheModalOpen(false)}
            />
          )}

          <CampaignInviteAcceptModal
            isOpen={acceptModalOpen}
            onClose={() => setAcceptModalOpen(false)}
            campaignPublicId={campaignId}
            campaignTitle={data.title}
            inviteData={data}
          />

          <CampaignInviteDeclineModal
            isOpen={declineModalOpen}
            onClose={() => setDeclineModalOpen(false)}
            campaignPublicId={campaignId}
            onDeclineRecorded={() => setInviteDeclined(true)}
          />

          <div className="flex flex-col gap-4 pt-2 border-t border-neutral-100">
            {inviteDeclined ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm text-neutral-700">
                Registramos que você não vai participar desta campanha. Se mudar de ideia, peça um
                novo convite à marca.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="default"
                  className="w-full sm:flex-1 min-w-0"
                  onClick={handleAccept}
                >
                  Aceitar convite
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:flex-1 min-w-0"
                  onClick={handleDeclineClick}
                >
                  Recusar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
