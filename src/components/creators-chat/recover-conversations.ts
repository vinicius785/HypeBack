import { getCampaignUsers } from "@/shared/services/campaign-users";
import { RateLimitError, getInfluencerMessages } from "@/shared/services/chat";

import type { Conversation } from "./creators-conversations";

const MAX_CHECKS = 1500;
/** Poucas consultas ao mesmo tempo e uma pausa entre elas: a API limita as requisições (429). */
const CONCURRENCY = 2;
const PAUSE_MS = 150;
const MAX_RATE_WAITS = 2;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Roda `fn` sobre `items` com no máximo `limit` chamadas ao mesmo tempo. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export interface RecoverProgress {
  phase: "campaigns" | "messages";
  done: number;
  total: number;
  /** A API pediu para esperar (429): a varredura está em pausa. */
  waiting?: boolean;
}

/**
 * Reconstrói conversas que já saíram das notificações: para cada criador de cada campanha, olha se há mensagens e, havendo,
 * monta a conversa com a última. É só leitura (nenhuma mensagem é marcada como lida) e limitada a MAX_CHECKS consultas.
 */
export async function recoverConversations(
  campaigns: Array<{ id: string; title: string }>,
  onProgress: (p: RecoverProgress) => void,
): Promise<Conversation[]> {
  const targets: Array<{ campaignId: string; campaign: string; userId: string; name: string; avatar?: string }> = [];
  let done = 0;
  await pool(campaigns, 2, async (c) => {
    try {
      for (const u of await getCampaignUsers(c.id)) {
        if (u.user_id == null) continue;
        targets.push({ campaignId: c.id, campaign: c.title, userId: String(u.user_id), name: u.name, avatar: u.avatar || undefined });
      }
    } catch {
      // Campanha sem acesso: segue com as outras.
    }
    onProgress({ phase: "campaigns", done: ++done, total: campaigns.length });
  });

  const list = targets.slice(0, MAX_CHECKS);
  const found: Conversation[] = [];
  done = 0;
  let stopped = false;
  await pool(list, CONCURRENCY, async (t) => {
    if (stopped) return;
    try {
      let msgs: Awaited<ReturnType<typeof getInfluencerMessages>> = [];
      for (let attempt = 0; ; attempt++) {
        try {
          msgs = await getInfluencerMessages(t.campaignId, t.userId);
          break;
        } catch (err) {
          // 429: espera o que a API pediu e tenta de novo; se continuar limitando, para a varredura (o que já veio fica).
          if (err instanceof RateLimitError && attempt < MAX_RATE_WAITS) {
            onProgress({ phase: "messages", done, total: list.length, waiting: true });
            await sleep(err.retryAfterMs);
            continue;
          }
          if (err instanceof RateLimitError) stopped = true;
          throw err;
        }
      }
      if (msgs.length > 0) {
        const last = [...msgs].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
        found.push({
          id: `${t.campaignId}:${t.userId}`,
          campaignId: t.campaignId,
          influencerId: t.userId,
          name: t.name,
          avatar: t.avatar,
          campaign: t.campaign,
          preview: last.message || (last.attachments?.length ? "Anexo" : ""),
          unread: 0,
          at: last.created_at,
        });
      }
    } catch {
      // Sem chat com este criador.
    }
    onProgress({ phase: "messages", done: ++done, total: list.length });
    await sleep(PAUSE_MS);
  });
  return found;
}
