import type { ReactNode } from "react";

import { AdminEmptyState } from "./admin-empty-state";
import { AdminLink, type AdminLinkTarget } from "./admin-link";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-not-found.css";

interface AdminNotFoundProps {
  /** O que não foi achado, em minúsculas e no singular: "workspace", "usuário", "campanha". */
  entity: string;
  /** Para onde o botão leva: a lista da entidade. */
  backTo: AdminLinkTarget;
  /** Texto do botão. Padrão: "Voltar para a lista". */
  backLabel?: string;
  /** Concorda "este/esta". Sem ele deduz pela terminação ("campanha", "notificação" → esta). */
  feminine?: boolean;
  /** Substitui a frase de apoio. */
  description?: ReactNode;
  /** Sobre o fundo cinza da página (fora de um cartão): vira um cartão branco. Padrão: sim, é o único conteúdo da página. */
  boxed?: boolean;
}

/** Terminações femininas comuns nos nomes do Admin; as exceções ("problema") passam `feminine={false}`. */
const FEMININE_ENDING = /(a|ão|ade|agem)$/i;
const MASCULINE_EXCEPTIONS = new Set(["problema", "mapa", "dia", "sistema"]);

function isFeminine(entity: string): boolean {
  const last = entity.trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (MASCULINE_EXCEPTIONS.has(last)) return false;
  return FEMININE_ENDING.test(last);
}

/**
 * "Não encontramos este <entity>": o registro não existe (ou o endereço está errado) e repetir a consulta não
 * adianta, então o estado oferece UMA saída, voltar para a lista. É o `AdminEmptyState` (o registro não falhou,
 * ele não está lá), com o botão como link de verdade (abre em nova aba, funciona sem JavaScript do roteador).
 * Falha de consulta (rede, permissão, servidor) continua sendo `AdminErrorState`.
 */
export function AdminNotFound({ entity, backTo, backLabel = "Voltar para a lista", feminine, description, boxed = true }: AdminNotFoundProps) {
  const demonstrative = (feminine ?? isFeminine(entity)) ? "esta" : "este";
  return (
    <AdminEmptyState
      boxed={boxed}
      icon="search"
      title={`Não encontramos ${demonstrative} ${entity}`}
      description={description ?? "O endereço pode estar incorreto, ou o registro foi removido."}
      action={
        <AdminLink to={backTo} className="btn out adm-btn-sm adm-nf-back">
          {backLabel}
        </AdminLink>
      }
    />
  );
}
