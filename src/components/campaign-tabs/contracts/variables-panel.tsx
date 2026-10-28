import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/ui/icon";
import type { ContractVariable } from "@/shared/types";

const GROUP_LABEL: Record<ContractVariable["group"], string> = {
  influencer: "Dados do influenciador",
  brand: "Dados da marca",
  campaign: "Dados da campanha",
};

interface VariablesPanelProps {
  variables: ContractVariable[];
  isLoading?: boolean;
}

/**
 * Painel lateral de variáveis disponíveis. Renderiza somente quando o usuário
 * opta por "Upload próprio". O texto da tag é copiado para o clipboard ao
 * clicar — agiliza o preenchimento do contrato externo.
 */
export function VariablesPanel({ variables, isLoading }: VariablesPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<ContractVariable["group"], ContractVariable[]>();
    for (const v of variables) {
      const list = map.get(v.group) ?? [];
      list.push(v);
      map.set(v.group, list);
    }
    return map;
  }, [variables]);

  const handleCopy = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag);
      setCopied(tag);
      toast.success("Variável copiada");
      setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1500);
    } catch {
      toast.error("Não foi possível copiar — copie manualmente");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-neutral-900">
          Variáveis disponíveis
        </p>
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-full rounded-xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!variables.length) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-neutral-200 p-4 text-center">
        <Icon name="Info" size={20} color="#a3a3a3" />
        <p className="text-xs text-neutral-500">
          Nenhuma variável disponível no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-900">
          Variáveis disponíveis
        </p>
        <p className="text-xs text-neutral-500">
          Clique para copiar. Use a tag exata no seu contrato — ela será
          substituída pelo dado real no envio.
        </p>
      </div>

      <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-1">
        {(["influencer", "brand", "campaign"] as const).map((group) => {
          const items = grouped.get(group);
          if (!items?.length) return null;
          return (
            <div key={group} className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {GROUP_LABEL[group]}
              </p>
              <div className="flex flex-col gap-1">
                {items.map((v) => {
                  const isCopied = copied === v.tag;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => handleCopy(v.tag)}
                      title={v.description}
                      className="group flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-left hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                    >
                      <div className="flex flex-col min-w-0">
                        <code className="truncate text-xs font-mono text-primary-700">
                          {v.tag}
                        </code>
                        <span className="truncate text-[11px] text-neutral-500">
                          {v.label}
                        </span>
                      </div>
                      <Icon
                        name={isCopied ? "Check" : "Copy"}
                        size={14}
                        color={isCopied ? "#16a34a" : "#737373"}
                        className="shrink-0"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
