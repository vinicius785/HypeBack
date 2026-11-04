import { Icon } from "@/components/ui/icon";
import type { PublicMediaKit } from "@/shared/services/influencer";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const NETWORK_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  ugc: "UGC",
};

/** Número para o WhatsApp: só dígitos, com o 55 do Brasil quando vier sem. */
export function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

/** (11) 99999-0000 a partir de dígitos (com ou sem o 55); outro formato fica como veio. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  const n = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  // Celular do Brasil: 11 dígitos com o 9 depois do DDD. Qualquer outro número (ex.: de fora) fica como foi digitado.
  if (n.length === 11 && n[2] === "9") return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return phone;
}

/** Chamada e apresentação que o criador escreveu para a própria página. Sem texto, não aparece. */
export function MediaKitIntro({ kit }: { kit?: PublicMediaKit | null }) {
  if (!kit || (!kit.headline && !kit.intro)) return null;
  return (
    <section aria-label="Apresentação" className="rounded-3xl bg-white px-6 py-6 print:break-inside-avoid">
      {kit.headline ? <h2 className="text-2xl font-semibold tracking-[-0.03em] text-neutral-950">{kit.headline}</h2> : null}
      {kit.intro ? <p className="mt-2 max-w-[70ch] whitespace-pre-line text-[15px] leading-relaxed text-neutral-600">{kit.intro}</p> : null}
    </section>
  );
}

/** Tarifas por rede, só quando o criador liberou (a API não manda nada sem o aceite dele). */
export function MediaKitRates({ kit }: { kit?: PublicMediaKit | null }) {
  const groups = kit?.rates ?? [];
  if (groups.length === 0) return null;
  return (
    <section aria-label="Tarifas" className="flex flex-col gap-4 rounded-3xl bg-white px-6 py-6 print:break-inside-avoid">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-neutral-950">Tarifas</h2>
        <p className="mt-1 text-sm text-neutral-500">Valores por publicação, informados pelo próprio criador. Podem variar conforme o projeto.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.network_id} className="flex flex-col gap-3 rounded-2xl bg-neutral-100 px-4 py-4">
            <b className="text-sm font-semibold text-neutral-900">{NETWORK_LABEL[g.type] ?? g.type}</b>
            <ul className="flex flex-col gap-2">
              {g.items.map((it) => (
                <li key={it.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-neutral-600">{it.label}</span>
                  <b className="whitespace-nowrap font-semibold text-neutral-950">{brl(it.price_cents)}</b>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Contato comercial escolhido pelo criador para a página (não é o da conta). */
export function MediaKitContact({ kit }: { kit?: PublicMediaKit | null }) {
  const c = kit?.contact;
  if (!c || (!c.email && !c.phone)) return null;
  const link = "inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-800 print:hidden";
  return (
    <section aria-label="Contato comercial" className="flex flex-col gap-4 rounded-3xl bg-white px-6 py-6 print:break-inside-avoid">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-neutral-950">Contato comercial</h2>
        <p className="mt-1 text-sm text-neutral-500">Para propostas e parcerias.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {c.email ? (
          <a className={link} href={`mailto:${c.email}`}>
            <Icon name="Mail" size={16} color="currentColor" />
            {c.email}
          </a>
        ) : null}
        {c.phone ? (
          <a className={link} href={whatsappLink(c.phone)} target="_blank" rel="noopener noreferrer">
            <Icon name="MessageCircle" size={16} color="currentColor" />
            WhatsApp {formatPhone(c.phone)}
          </a>
        ) : null}
      </div>
      {/* No PDF os links não clicam: o contato vai escrito. */}
      <p className="hidden text-sm text-neutral-700 print:block">
        {[c.email, c.phone ? formatPhone(c.phone) : null].filter(Boolean).join(" · ")}
      </p>
    </section>
  );
}
