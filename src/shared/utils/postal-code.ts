/**
 * Consulta de CEP via ViaCEP (API pública gratuita, sem chave de acesso).
 *
 * SSOT do projeto para autofill de endereço a partir do CEP. Reutilizar aqui em
 * vez de duplicar o fetch em cada formulário (workspace, envio, etc.).
 */

/** Resposta relevante do ViaCEP (campos usados no autofill). */
export interface ViaCepAddress {
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

/**
 * Busca o endereço de um CEP brasileiro (8 dígitos).
 *
 * - Ignora silenciosamente CEPs mal formados (retorna `null`) — o caller decide a UX.
 * - Retorna `null` para CEP inexistente (`erro: true`) ou resposta HTTP não-ok.
 * - Lança em falha de rede, permitindo ao caller diferenciar "não encontrado"
 *   de "erro de conexão" (mesmo contrato dos formulários de workspace).
 *
 * @param raw   valor cru do input (com ou sem máscara).
 * @param signal AbortSignal opcional para cancelar buscas obsoletas.
 */
export async function lookupPostalCode(
  raw: string,
  signal?: AbortSignal,
): Promise<ViaCepAddress | null> {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
  if (!res.ok) return null;

  const data: ViaCepAddress = await res.json();
  if (data.erro) return null;
  return data;
}
