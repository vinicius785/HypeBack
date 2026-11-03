import { useId, useMemo, useState } from "react";

import { AdminNicheChart } from "@/components/admin/admin-niche-chart";
import { AdminSizeChart } from "@/components/admin/admin-size-chart";
import { AdminPeriodSelect, AdminSection, type AdminPeriodPresetOption } from "@/components/admin/platform";
import { useAdminCreatorsNicheProfile, useAdminCreatorsSizeProfile } from "@/hooks/admin/use-admin-creators-profile";
import { civilDateInSaoPaulo } from "@/lib/admin/format";
import type { AdminPeriod } from "@/shared/types";

import "@/styles/admin-creators.css";

type ProfilePreset = "30d" | "90d" | "6m" | "1y";

const DAY_MS = 86_400_000;

const PRESETS: readonly (AdminPeriodPresetOption & { id: ProfilePreset; days: number })[] = [
  { id: "30d", label: "30 dias", days: 30 },
  { id: "90d", label: "90 dias", days: 90 },
  { id: "6m", label: "6 meses", days: 180 },
  { id: "1y", label: "12 meses", days: 365 },
];

/** Os últimos N dias contando hoje (o mesmo critério do contrato novo), em dias de São Paulo. */
function periodFor(days: number): AdminPeriod {
  return { from: civilDateInSaoPaulo(Date.now() - (days - 1) * DAY_MS), to: civilDateInSaoPaulo() };
}

/**
 * "Perfil da base": nichos e porte dos criadores, com os mesmos gráficos do Dashboard. Fica recolhido: só consulta
 * quando a pessoa abre. As duas rotas são as do Dashboard antigo (não fazem parte do contrato novo), lidas pelo
 * cliente do Admin (`use-admin-creators-profile.ts`); o erro e o vazio ficam por conta dos próprios gráficos, e cada
 * um oferece o seu "Tentar de novo" (refaz só a consulta que falhou).
 *
 * O período é o `AdminPeriodSelect` (compacto, só os atalhos de hoje, no cabeçalho da seção, ao lado de "Ocultar"):
 * ele só apresenta; quem sabe que "6 meses" são 180 dias, contando hoje, é esta tela (`periodFor`).
 */
export function AdminCreatorsProfile() {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<ProfilePreset>("30d");
  const bodyId = useId();
  const period = useMemo(() => periodFor(PRESETS.find((p) => p.id === preset)?.days ?? 30), [preset]);

  const niche = useAdminCreatorsNicheProfile(period, 8, { enabled: open });
  const size = useAdminCreatorsSizeProfile(period, { enabled: open });

  return (
    <AdminSection
      className={open ? "adm-creators-profile" : "adm-creators-profile adm-creators-profile-closed"}
      title="Perfil da base"
      description="Nichos e porte dos criadores no período."
      actions={
        <>
          {open ? (
            <AdminPeriodSelect
              compact
              presets={PRESETS}
              value={{ preset }}
              onChange={(next) => {
                const chosen = PRESETS.find((p) => p.id === next.preset);
                if (chosen) setPreset(chosen.id);
              }}
              ariaLabel="Período do perfil da base"
            />
          ) : null}
          <button
            type="button"
            className="btn out adm-btn-sm"
            aria-label={open ? "Ocultar perfil da base" : "Mostrar perfil da base"}
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Ocultar" : "Mostrar"}
          </button>
        </>
      }
    >
      {open ? (
        <div id={bodyId}>
          <div className="adm-creators-profile-cols">
            <div>
              <h3>Nichos</h3>
              <AdminNicheChart
                data={niche.data}
                isLoading={niche.isLoading}
                isError={niche.isError}
                onRetry={() => void niche.refetch()}
                retrying={niche.isFetching}
              />
            </div>
            <div>
              <h3>Porte</h3>
              <AdminSizeChart
                data={size.data}
                isLoading={size.isLoading}
                isError={size.isError}
                onRetry={() => void size.refetch()}
                retrying={size.isFetching}
              />
            </div>
          </div>
        </div>
      ) : null}
    </AdminSection>
  );
}
