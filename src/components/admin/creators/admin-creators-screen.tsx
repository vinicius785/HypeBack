import { useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import {
  AdminPage,
  AdminPageHeader,
  AdminTabPanel,
  AdminTabs,
  type AdminTabItem,
} from "@/components/admin/platform";
import { parseAdminCreatorsTab, type AdminCreatorsTab } from "@/hooks/admin/use-admin-creators";

import { AdminCreatorsDuplicates } from "./admin-creators-duplicates";
import { AdminCreatorsInconsistencies } from "./admin-creators-inconsistencies";
import { AdminCreatorsList } from "./admin-creators-list";
import { CREATORS_READ_ONLY_NOTE } from "./creator-labels";

import "@/styles/admin-creators.css";

const TABS: readonly AdminTabItem<AdminCreatorsTab>[] = [
  { id: "creators", label: "Criadores" },
  { id: "duplicates", label: "Duplicados" },
  { id: "inconsistencies", label: "Inconsistências" },
];

const ID_PREFIX = "adm-creators";

/**
 * `/admin/creators`: a base de criadores da plataforma, somente leitura, em três abas (Criadores, Duplicados,
 * Inconsistências) guardadas na URL (`?tab=`). Só a aba aberta é montada, então só ela consulta o servidor.
 * O aviso de "somente leitura" é um só, no subtítulo, e vale para as três.
 *
 * Trocar de aba troca a busca inteira da URL: os filtros e a página de uma aba não passam para a outra (e o link
 * de uma aba abre direto nela). O espaçamento entre os blocos de cada aba vem do próprio painel (`className`).
 */
export function AdminCreatorsScreen() {
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const tab = parseAdminCreatorsTab(raw.tab);

  const selectTab = useCallback(
    (next: AdminCreatorsTab) => {
      navigate({
        to: ".",
        search: (next === "creators" ? {} : { tab: next }) as never,
        replace: true,
        resetScroll: false,
      } as never);
    },
    [navigate],
  );

  return (
    <AdminPage>
      <AdminPageHeader title="Criadores" subtitle={`A base de criadores da plataforma. ${CREATORS_READ_ONLY_NOTE}`} />

      <AdminTabs tabs={TABS} value={tab} onChange={selectTab} ariaLabel="Seções de criadores" idPrefix={ID_PREFIX} />

      <AdminTabPanel idPrefix={ID_PREFIX} id="creators" active={tab === "creators"} className="adm-creators-panel">
        <AdminCreatorsList />
      </AdminTabPanel>
      <AdminTabPanel idPrefix={ID_PREFIX} id="duplicates" active={tab === "duplicates"} className="adm-creators-panel">
        <AdminCreatorsDuplicates />
      </AdminTabPanel>
      <AdminTabPanel
        idPrefix={ID_PREFIX}
        id="inconsistencies"
        active={tab === "inconsistencies"}
        className="adm-creators-panel"
      >
        <AdminCreatorsInconsistencies />
      </AdminTabPanel>
    </AdminPage>
  );
}
