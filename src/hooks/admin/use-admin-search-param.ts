import { useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

/**
 * Um parâmetro de busca da URL como estado (aba selecionada, visão): `?tab=members`.
 * O valor padrão não aparece na URL; valor fora de `allowed` volta ao padrão. Troca por `replace`.
 *
 * ```tsx
 * const [tab, setTab] = useAdminSearchParam("tab", "resumo", ["resumo", "membros", "financeiro"] as const);
 * ```
 * A rota precisa deixar a chave passar no `validateSearch` (`(raw) => ({ tab: raw.tab })`).
 */
export function useAdminSearchParam<T extends string>(
  key: string,
  defaultValue: T,
  allowed?: readonly T[],
): [T, (value: T) => void] {
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();

  const current = raw[key];
  const text = typeof current === "string" ? current : typeof current === "number" ? String(current) : undefined;
  const value = (text !== undefined && (!allowed || (allowed as readonly string[]).includes(text)) ? text : defaultValue) as T;

  const setValue = useCallback(
    (next: T) => {
      navigate({
        to: ".",
        search: ((prev: Record<string, unknown>) => {
          const out = { ...prev };
          if (next === defaultValue) delete out[key];
          else out[key] = next;
          return out;
        }) as never,
        replace: true,
        resetScroll: false,
      } as never);
    },
    [navigate, key, defaultValue],
  );

  return [value, setValue];
}
