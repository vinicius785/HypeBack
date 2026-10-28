import { getContentTypesForNetwork } from "@/shared/constants/campaign-formats";

/**
 * Rótulo do formato de conteúdo, derivado do vocabulário canônico da campanha
 * (`@/shared/constants/campaign-formats`). Em caso de formato desconhecido,
 * devolve o texto original recebido do backend.
 */
export function formatContentTypeLabel(network: string, contentType: string): string {
  if (!contentType) return contentType;
  const match = getContentTypesForNetwork(network).find(
    (option) => option.value === contentType.toLowerCase(),
  );
  return match?.label ?? contentType;
}

/**
 * Valida se a URL parece ser um perfil/conteúdo da rede indicada.
 * Para `ugc`, aceita qualquer http(s) com host não vazio.
 */
export function isValidProfileUrlForNetwork(url: string, network: string): boolean {
  const t = url.trim();
  if (!t) return false;
  let parsed: URL;
  try {
    parsed = new URL(t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  const n = network.toLowerCase();
  switch (n) {
    case "instagram":
      return (
        host === "instagram.com" ||
        host.endsWith(".instagram.com") ||
        host === "instagr.am" ||
        host.endsWith(".instagr.am")
      );
    case "tiktok":
      return host.includes("tiktok.com");
    case "youtube":
      return host.includes("youtube.com") || host.includes("youtu.be");
    case "facebook":
      return host.includes("facebook.com") || host.includes("fb.com") || host.includes("fb.watch");
    case "twitter":
      return host.includes("twitter.com") || host.includes("x.com");
    case "linkedin":
      return host.includes("linkedin.com");
    case "ugc":
      return true;
    default:
      return true;
  }
}
