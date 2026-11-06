import { useEffect, useState } from "react";

import { adminInitials } from "@/components/admin/platform";
import { getUploadUrl } from "@/lib/utils/api";

import "@/styles/admin-campaigns.css";

function resolveBanner(banner: string | null): string | undefined {
  if (!banner) return undefined;
  try {
    return getUploadUrl(banner);
  } catch {
    // Sem VITE_SERVER_URL (ambiente de teste) não há como montar a URL: cai nas iniciais.
    return undefined;
  }
}

/**
 * Banner da campanha numa caixa quadrada, a proporção em que ele é feito (`campaign-banner.ts`). A imagem preenche a caixa
 * (`object-fit: cover`): na proporção certa aparece inteira; um arquivo de outra proporção é cortado nas bordas em
 * vez de deixar faixas vazias. Sem banner (ou com a imagem quebrada) entram as iniciais do título. Decorativo: o
 * título já está ao lado.
 */
export function AdminCampaignBanner({ title, banner }: { title: string; banner: string | null }) {
  const url = resolveBanner(banner);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);

  return (
    <span className="adm-campaigns-banner" aria-hidden="true">
      {url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} /> : <span>{adminInitials(title) || "?"}</span>}
    </span>
  );
}
