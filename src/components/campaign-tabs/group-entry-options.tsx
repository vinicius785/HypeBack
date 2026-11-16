import { useId } from "react";

/** Aviso fixo: quem entra no grupo lê tudo o que for postado nele. */
export const GROUP_ENTRY_WARNING =
  "Quem entra no grupo vê tudo que for postado nele (briefing, regras, valores, conversa). Com a entrada automática ao se inscrever, TODO inscrito vê esse conteúdo, inclusive quem não for aprovado. Adicionar inscritos não aprovados à mão expõe o mesmo conteúdo.";

interface EntryMode {
  key: string;
  approval: boolean;
  application: boolean;
  label: string;
  /** Rótulo curto, para o cartão do grupo. */
  short: string;
  text: string;
}

/** Os quatro modos e os dois booleanos da API que cada um grava. */
const ENTRY_MODES: EntryMode[] = [
  { key: "manual", approval: false, application: false, label: "Só manual", short: "Só manual", text: "Ninguém entra sozinho. A equipe escolhe quem entra, inclusive quem ainda não foi aprovado." },
  { key: "approval", approval: true, application: false, label: "Ao aprovar", short: "Ao aprovar", text: "Quem for aprovado na campanha entra sozinho. É o padrão." },
  { key: "application", approval: false, application: true, label: "Ao se inscrever", short: "Ao se inscrever", text: "Quem se inscrever pelo app entra na hora, sem esperar aprovação. Vale só para inscrições novas: quem já está inscrito entra pela adição manual." },
  { key: "both", approval: true, application: true, label: "Inscrição e aprovação", short: "Ao se inscrever e ao aprovar", text: "Entra ao se inscrever e, se ainda não estiver no grupo, ao ser aprovado. Vale só para inscrições novas: quem já está inscrito entra pela adição manual." },
];

/** Rótulo legível do modo de entrada, para o cartão do grupo. */
export function entryModeLabel(autoJoinOnApproval: boolean, autoJoinOnApplication = false): string {
  return (ENTRY_MODES.find((mode) => mode.approval === autoJoinOnApproval && mode.application === autoJoinOnApplication) ?? ENTRY_MODES[0]).short;
}

/**
 * Situações em que a pessoa já passou da aprovação da campanha (o status vem do enum do backend). Quem está fora
 * daqui (inscrito, em curadoria, convidado, recusado) não foi aprovado.
 */
const APPROVED_STATUSES = new Set(["approved", "pending_approval", "in_correction", "content_approved", "published"]);

export function isCampaignApproved(status: string): boolean {
  return APPROVED_STATUSES.has(status);
}

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  applications: "Inscrito",
  curation: "Em curadoria",
  invited: "Convidado",
  approved: "Aprovado",
  pending_approval: "Conteúdo enviado",
  in_correction: "Em correção",
  content_approved: "Conteúdo aprovado",
  published: "Publicado",
  rejected: "Recusado",
};

export function campaignStatusLabel(status: string): string {
  return CAMPAIGN_STATUS_LABEL[status] ?? status;
}

export interface GroupEntryValue {
  /** `auto_join_on_approval` */
  autoJoin: boolean;
  /** `auto_join_on_application` */
  autoJoinOnApplication: boolean;
  removeOnExit: boolean;
}

interface GroupEntryOptionsProps extends GroupEntryValue {
  onChange: (next: GroupEntryValue) => void;
  disabled?: boolean;
}

/**
 * "Como as pessoas entram" (seletor de quatro modos) e "Quando sair da campanha" (liga/desliga). Serve à tela de editar e
 * ao formulário de criar. O modo vem dos dois booleanos de entrada e volta como os dois.
 */
export function GroupEntryOptions({ autoJoin, autoJoinOnApplication, removeOnExit, onChange, disabled = false }: GroupEntryOptionsProps) {
  const name = useId();
  const current = ENTRY_MODES.find((mode) => mode.approval === autoJoin && mode.application === autoJoinOnApplication) ?? ENTRY_MODES[0];
  return (
    <div className="gent">
      <fieldset className="gent-set" disabled={disabled}>
        <legend>Como as pessoas entram</legend>
        <div className="gent-seg">
          {ENTRY_MODES.map((mode) => (
            <label key={mode.key} data-on={mode === current}>
              <input
                type="radio"
                name={name}
                checked={mode === current}
                onChange={() => onChange({ autoJoin: mode.approval, autoJoinOnApplication: mode.application, removeOnExit })}
              />
              <span>{mode.label}</span>
            </label>
          ))}
        </div>
        <p className="gent-hint">{current.text}</p>
      </fieldset>

      <div className="gent-tgl">
        <span id={`${name}-remove`}>
          <b>Remover quem sair ou for reprovado</b>
          <small>Desligado, quem entrou antes de aprovar e foi reprovado continua no grupo.</small>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={removeOnExit}
          aria-labelledby={`${name}-remove`}
          disabled={disabled}
          onClick={() => onChange({ autoJoin, autoJoinOnApplication, removeOnExit: !removeOnExit })}
        >
          <i className={`tgl${removeOnExit ? " on" : ""}`} aria-hidden="true">
            <i />
          </i>
        </button>
      </div>

      <p className="gent-warn" role="note">
        {GROUP_ENTRY_WARNING}
      </p>
    </div>
  );
}
