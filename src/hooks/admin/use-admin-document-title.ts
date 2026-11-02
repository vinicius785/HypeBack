import { useEffect } from "react";

export const ADMIN_TITLE_SUFFIX = "Admin · HypeApp";

/** `'Workspaces'` -> `'Workspaces · Admin · HypeApp'`; o nome de um registro entra no lugar do nome da página. */
export function adminDocumentTitle(pageTitle: string): string {
  const name = pageTitle.trim();
  return name ? `${name} · ${ADMIN_TITLE_SUFFIX}` : ADMIN_TITLE_SUFFIX;
}

// Títulos das páginas montadas agora (a última a montar manda) e o título de antes de o Admin assumir.
const mounted: string[] = [];
let baseTitle = "";

/**
 * Título da aba do navegador de cada página do Admin: sem ele a aba nunca muda entre as telas e quem usa
 * leitor de tela não ouve a troca de página. As telas não chamam isto direto: o `AdminPageHeader` usa com o
 * próprio título (texto), então toda página do kit ganha o título e as de detalhe levam o nome do registro.
 *
 * `undefined` (ex.: o título ainda é um esqueleto de carregamento) deixa o título como está. Ao desmontar, a
 * aba volta ao título da página que ficou por cima, ou ao que havia antes do Admin quando não sobra nenhuma:
 * uma lista que fecha depois de o detalhe já ter aberto não apaga o título do detalhe.
 */
export function useAdminDocumentTitle(pageTitle: string | undefined): void {
  useEffect(() => {
    if (pageTitle === undefined || typeof document === "undefined") return;
    const next = adminDocumentTitle(pageTitle);
    if (mounted.length === 0) baseTitle = document.title;
    mounted.push(next);
    document.title = next;
    return () => {
      mounted.splice(mounted.lastIndexOf(next), 1);
      document.title = mounted.length > 0 ? mounted[mounted.length - 1] : baseTitle;
    };
  }, [pageTitle]);
}
