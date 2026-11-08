import { useEffect, useRef } from "react";

import { PageContainer } from "@/components/page/page-kit";
import { I } from "@/components/prototype/ui";
import { ProjectTasksBoard } from "@/components/agency-projects/board";
import { useProjectPermissions } from "@/components/agency-projects/use-project-permissions";
import { useCampaignBoard, useOpenCampaignBoard } from "@/hooks/use-agency-projects";
import { agencyProjectErrorMessage, isAgencyProjectsUnavailable } from "@/shared/services/agency-projects";

import "@/styles/agency-projects.css";

/**
 * Tarefas da campanha (agência): o Kanban dos Projetos, com as tarefas desta campanha. O quadro é criado na primeira
 * vez que alguém com permissão de escrita abre a aba; quem só lê vê o estado vazio até lá.
 */
export function CampaignTasksTab({ campaignId }: { campaignId: string }) {
  const can = useProjectPermissions();
  const { data: board, isLoading, error, refetch, isFetching } = useCampaignBoard(campaignId);
  const open = useOpenCampaignBoard(campaignId);
  const asked = useRef(false);

  // Primeira abertura: a leitura voltou "sem quadro" e a pessoa pode escrever, então cria (uma vez).
  useEffect(() => {
    if (board === null && can.canWrite && !asked.current && !open.isPending) {
      asked.current = true;
      open.mutate();
    }
  }, [board, can.canWrite, open]);

  if (isAgencyProjectsUnavailable(error)) {
    return (
      <div className="pv">
        <div className="ov-empty big">
          <span>
            <I n="clock" />
          </span>
          <b>Tarefas da campanha ainda não estão disponíveis</b>
          <small>Esta função chega ao seu workspace em breve.</small>
        </div>
      </div>
    );
  }

  if (error || open.isError) {
    return (
      <div className="pv">
        <div className="ov-empty big">
          <span>
            <I n="alert" />
          </span>
          <b>Não foi possível abrir as tarefas</b>
          <small>{agencyProjectErrorMessage(error ?? open.error, "Tente de novo em instantes.")}</small>
          <button type="button" className="btn out" disabled={isFetching} onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || open.isPending || (board === null && can.canWrite)) {
    return (
      <div className="pv">
        <div className="apj-detail-sk" aria-busy="true" aria-label="Carregando tarefas">
          <span className="apj-sk" style={{ width: "100%", height: 112, borderRadius: 28, display: "block" }} />
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="pv">
        <div className="ov-empty big">
          <span>
            <I n="list" />
          </span>
          <b>Nenhuma tarefa ainda</b>
          <small>Quem edita campanhas cria o quadro de tarefas ao abrir esta aba.</small>
        </div>
      </div>
    );
  }

  // Mesma moldura da página do projeto: `.pv` (estilos do protótipo), `PageContainer` (`.pgk`: os estilos da barra de
  // busca, filtros e ordenação, que só valem dentro dele) e `apj-sec` (espaçamento da seção). Fora deles o quadro
  // aparece sem estilo, ou com a barra empilhada como texto solto.
  return (
    <div className="pv">
      <PageContainer>
        <section className="apj-sec ctk-card" aria-label="Tarefas da campanha">
          <ProjectTasksBoard project={board} can={can} />
        </section>
      </PageContainer>
    </div>
  );
}
