/** Pop-ups de abertura do app: lista, opções do formulário e criar, editar e excluir. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminDelete, adminGet, adminPatchPlain, adminPostPlain } from "@/lib/admin/admin-client";
import type { Popup, PopupBody, PopupOptions } from "@/shared/popups.types";

const BASE = "/admin/popups";

export const popupKeys = {
  list: ["admin", "popups", "list"] as const,
  options: ["admin", "popups", "options"] as const,
};

export function usePopups() {
  return useQuery({ queryKey: popupKeys.list, queryFn: ({ signal }) => adminGet<Popup[]>(BASE, undefined, { signal }), staleTime: 15_000 });
}

/** Chamada ao abrir o formulário: temas, ícones e telas vêm da API. */
export function usePopupOptions(enabled = true) {
  return useQuery({ queryKey: popupKeys.options, queryFn: ({ signal }) => adminGet<PopupOptions>(`${BASE}/options`, undefined, { signal }), enabled, staleTime: 5 * 60_000 });
}

export function usePopupMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: popupKeys.list });
  return {
    create: useMutation<Popup, unknown, PopupBody>({ mutationFn: (body) => adminPostPlain<Popup>(BASE, body), onSuccess: refresh }),
    update: useMutation<Popup, unknown, { id: string; body: PopupBody }>({
      mutationFn: ({ id, body }) => adminPatchPlain<Popup>(`${BASE}/${encodeURIComponent(id)}`, body),
      onSuccess: refresh,
    }),
    remove: useMutation<void, unknown, string>({ mutationFn: (id) => adminDelete(`${BASE}/${encodeURIComponent(id)}`), onSuccess: refresh }),
  };
}
