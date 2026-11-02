import { useId, useMemo, useState } from "react";

import { AdminNicheChart } from "@/components/admin/admin-niche-chart";
import { AdminSizeChart } from "@/components/admin/admin-size-chart";
import { AdminSection, AdminSegmentedControl, type AdminFilterOption } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useAdminCreatorsNicheProfile, useAdminCreatorsSizeProfile } from "@/hooks/admin/use-admin-creators-profile";
import { civilDateInSaoPaulo } from "@/lib/admin/format";
import type { AdminPeriod } from "@/shared/types";

import "@/styles/admin-creators.css";

type ProfilePreset = "30d" | "90d" | "6m" | "1y";

const DAY_MS = 86_400_000;

const PRESETS: readonly (AdminFilterOption & { value: ProfilePreset; days: number })[] = [
  { value: "30d", label: "30 dias", days: 30 },
  { value: "90d", label: "90 dias", days: 90 },
  { value: "6m", label: "6 meses", days: 180 },
  { value: "1y", label: "12 meses", days: 365 },
];

/** Os últimos N dias contando hoje (o mesmo critério do contrato novo), em dias de São Paulo. */
function periodFor(days: number): AdminPeriod {
  return { from: civilDateInSaoPaulo(Date.now() - (days - 1) * DAY_MS), to: civilDateInSaoPaulo() };
}

/**
 * "Perfil da base": nichos e porte dos criadores, com os mesmos gráficos do Dashboard. Fica recolhido: só consulta
 * quando a pessoa abre. As duas rotas são as do Dashboard antigo (não fazem parte do contrato novo), lidas pelo
 * cliente do Admin (`use-admin-creators-profile.ts`); o erro e o vazio ficam por conta dos próprios gráficos e há
 * um "Tentar de novo".
 */
export function AdminCreatorsProfile() {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<ProfilePreset>("30d");
  const bodyId = useId();
  const period = useMemo(() => periodFor(PRESETS.find((p) => p.value === preset)?.days ?? 30), [preset]);

  const niche = useAdminCreatorsNicheProfile(period, 8, { enabled: open });
  const size = useAdminCreatorsSizeProfile(period, { enabled: open });
  const failed = niche.isError || size.isError;
  const retrying = niche.isFetching || size.isFetching;

  return (
    <AdminSection
      className={open ? "adm-creators-profile" : "adm-creators-profile adm-creators-profile-closed"}
      title="Perfil da base"
      description="Nichos e porte dos criadores no período."
      actions={
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
      }
    >
      {open ? (
        <div id={bodyId} className="adm-creators-profile-body">
          <div className="adm-creators-profile-tools">
            <AdminSegmentedControl
              options={PRESETS}
              value={preset}
              onChange={(value) => {
                const next = PRESETS.find((p) => p.value === value);
                if (next) setPreset(next.value);
              }}
              ariaLabel="Período do perfil da base"
            />
            {failed ? (
              <button
                type="button"
                className="btn out adm-btn-sm"
                disabled={retrying}
                onClick={() => {
                  if (niche.isError) void niche.refetch();
                  if (size.isError) void size.refetch();
                }}
              >
                <I n="refresh" cls="sm" />
                {retrying ? "Tentando…" : "Tentar de novo"}
              </button>
            ) : null}
          </div>
          <div className="adm-creators-profile-cols">
            <div>
              <h3>Nichos</h3>
              <AdminNicheChart data={niche.data} isLoading={niche.isLoading} isError={niche.isError} />
            </div>
            <div>
              <h3>Porte</h3>
              <AdminSizeChart data={size.data} isLoading={size.isLoading} isError={size.isError} />
            </div>
          </div>
        </div>
      ) : null}
    </AdminSection>
  );
}
