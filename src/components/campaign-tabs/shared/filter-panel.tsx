import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface PhaseOption {
  value: string;
  label: string;
}

interface StatusOption {
  key: string;
  label: string;
}

interface FilterPanelProps {
  /** Valor da busca por influenciador */
  search: string;
  onSearchChange: (value: string) => void;

  /** Opções de fases (incluindo "Todas as fases") */
  phaseOptions?: PhaseOption[];
  selectedPhase?: string;
  onPhaseChange?: (value: string) => void;

  /** Tabs de status (pills horizontais). Ex: Pendentes | Aprovados | Reprovados */
  statusOptions?: StatusOption[];
  selectedStatus?: string;
  onStatusChange?: (key: string) => void;

  /** Elementos adicionais renderizados à direita da busca */
  extra?: React.ReactNode;
}

/**
 * Painel de filtros reutilizável.
 *
 * Renderiza dois blocos:
 * 1. Card branco com busca + seletor de fases (+ `extra`)
 * 2. Pills de status (apenas quando `statusOptions` for passado)
 */
export function FilterPanel({
  search,
  onSearchChange,
  phaseOptions,
  selectedPhase,
  onPhaseChange,
  statusOptions,
  selectedStatus,
  onStatusChange,
  extra,
}: FilterPanelProps) {
  return (
    <>
      {/* Card: busca + fases */}
      <div className="bg-white rounded-[12px] p-5 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <Input
            label="Buscar influenciador"
            placeholder="Nome ou @username"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {phaseOptions && onPhaseChange && (
          <div className="w-full sm:w-[258px]">
            <Select
              label="Fases"
              placeholder="Todas as fases"
              options={phaseOptions}
              value={selectedPhase ?? "all"}
              onChange={onPhaseChange}
            />
          </div>
        )}
        {extra}
      </div>

      {/* Pills de status */}
      {statusOptions && onStatusChange && (
        <div className="flex gap-1 flex-wrap">
          {statusOptions.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onStatusChange(key)}
              className={`h-11 px-4 py-2.5 rounded-full text-base font-semibold transition-colors ${
                selectedStatus === key
                  ? "bg-primary-600 text-white"
                  : "border border-[#e5e5e5] text-[#737373] hover:bg-neutral-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
