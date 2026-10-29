import { useEffect, useRef, useState } from "react";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

import hypeappLogo from "@/assets/images/hypeapp-logo-branca.svg";
import { Icon, type IconName } from "@/components/ui/icon";
import { AuthIntro } from "@/components/auth-intro";

export const Route = createFileRoute("/(public)")({
  component: RouteComponent,
});

function RouteComponent() {
  const { pathname } = useLocation();
  // Páginas públicas full-width (sem o split de auth com imagem lateral):
  // convite de campanha e perfil público do influenciador `/u/:username`.
  const isFullWidthPublic =
    /\/campaigns\/[^/]+\/invite\/?$/.test(pathname) ||
    /\/u\/[^/]+\/?$/.test(pathname);

  if (isFullWidthPublic) {
    return (
      <div className="min-h-screen w-full bg-neutral-100 overflow-y-auto">
        <Outlet />
      </div>
    );
  }

  return <AuthShell pathname={pathname} />;
}

const SLIDE_MS = 5500;

const NAV: Array<[IconName, string]> = [
  ["LayoutGrid", "Início"],
  ["Megaphone", "Campanhas"],
  ["Users", "Criadores"],
  ["Video", "Lives"],
  ["Wallet", "Financeiro"],
];

const SLIDES: Array<{ title: string; text: string; nav: string }> = [
  {
    title: "Campanhas, criadores e pagamentos num lugar só",
    text: "Acompanhe tudo o que precisa da sua decisão sem sair do HypeApp.",
    nav: "Campanhas",
  },
  {
    title: "Aprove roteiros e conteúdos em um toque",
    text: "Veja o que cada criador enviou, aprove ou peça ajustes na hora.",
    nav: "Criadores",
  },
  {
    title: "Pague os criadores sem sair da conta",
    text: "Adicione saldo via PIX e libere o pagamento quando o conteúdo for publicado.",
    nav: "Financeiro",
  },
];

function MockMain({ slide }: { slide: number }) {
  if (slide === 0) {
    return (
      <>
        <div className="au-up rounded-[28px] bg-neutral-950 p-6" style={{ ["--d" as string]: "0ms" }}>
          <p className="text-[18px] font-semibold tracking-[-0.03em]">Tarefas e aprovações</p>
          <small className="text-[13px] text-white/55">O que precisa da sua decisão</small>
          <p className="mt-4 text-[64px] font-semibold leading-[0.95] tracking-[-0.06em]">
            12 <span className="text-[15px] font-medium tracking-normal text-white/55">itens aguardando você</span>
          </p>
          <div className="mt-5 flex items-center gap-3 rounded-[22px] bg-white/8 p-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-white">
              <Icon name="FileText" color="#050505" size={20} />
            </span>
            <div className="flex-1 leading-tight">
              <b className="block whitespace-nowrap text-[14.5px] font-semibold">Roteiros · 5</b>
              <small className="text-[12.5px] text-white/55">Campanha ativa</small>
            </div>
            <span className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-neutral-950">Revisar</span>
          </div>
        </div>
        <div className="au-up hidden rounded-[28px] bg-white p-6 text-neutral-950 [@media(min-height:800px)]:block" style={{ ["--d" as string]: "120ms" }}>
          <p className="text-[18px] font-semibold tracking-[-0.03em]">Métricas no workspace</p>
          <small className="text-[13px] text-neutral-500">Alcance estimado</small>
          <p className="text-[48px] font-semibold leading-none tracking-[-0.06em]">3.753.421</p>
        </div>
      </>
    );
  }

  if (slide === 1) {
    const rows: Array<[string, string, string]> = [
      ["JT", "Joana Tech", "Roteiro enviado"],
      ["MC", "Marcos Cook", "Conteúdo para aprovar"],
      ["LA", "Luísa Andrade", "Conteúdo para aprovar"],
    ];
    return (
      <div className="au-up rounded-[28px] bg-neutral-950 p-6" style={{ ["--d" as string]: "0ms" }}>
        <p className="text-[18px] font-semibold tracking-[-0.03em]">Precisa da sua ação</p>
        <small className="text-[13px] text-white/55">3 itens aguardando</small>
        <div className="mt-5 flex flex-col gap-3">
          {rows.map(([ini, name, st], k) => (
            <div key={name} className="au-up flex items-center gap-3 rounded-[22px] bg-white/8 p-3" style={{ ["--d" as string]: `${100 + k * 110}ms` }}>
              <span className="grid size-11 place-items-center rounded-full bg-white text-[13px] font-bold text-neutral-950">{ini}</span>
              <div className="flex-1 leading-tight">
                <b className="block text-[14.5px] font-semibold">{name}</b>
                <small className="text-[12.5px] text-white/55">{st}</small>
              </div>
              <span className="rounded-full bg-primary-600 px-4 py-2 text-[13px] font-bold">Aprovar</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const moves: Array<[string, string]> = [
    ["Pagamento · Joana Tech", "− R$ 1.200"],
    ["Depósito via PIX", "+ R$ 5.000"],
    ["Pagamento · Marcos Cook", "− R$ 800"],
  ];
  return (
    <>
      <div className="au-up rounded-[28px] bg-white p-6 text-neutral-950" style={{ ["--d" as string]: "0ms" }}>
        <small className="text-[13px] text-neutral-500">Saldo disponível</small>
        <p className="text-[52px] font-semibold leading-none tracking-[-0.06em]">R$ 3.000</p>
      </div>
      <div className="au-up rounded-[28px] bg-neutral-950 p-6" style={{ ["--d" as string]: "120ms" }}>
        <p className="text-[18px] font-semibold tracking-[-0.03em]">Movimentações</p>
        <div className="mt-4 flex flex-col gap-2.5">
          {moves.map(([l, v], k) => (
            <div key={l} className="au-up flex items-center justify-between rounded-[20px] bg-white/8 px-4 py-3 text-[14px]" style={{ ["--d" as string]: `${220 + k * 100}ms` }}>
              <span className="font-semibold">{l}</span>
              <b className={v.startsWith("+") ? "text-primary-300" : ""}>{v}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function AuthShell({ pathname }: { pathname: string }) {
  const [slide, setSlide] = useState(0);
  // Abertura: logo -> gota roxa expande até virar o card. Pulada sem espaço
  // para a vitrine (celular) ou com "reduzir movimento".
  const panelRef = useRef<HTMLElement>(null);
  const logoTargetRef = useRef<HTMLImageElement>(null);
  const [intro, setIntro] = useState<"logo" | "expand" | "done">(() => {
    if (typeof window === "undefined") return "done";
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return wide && !calm ? "logo" : "done";
  });
  const ready = intro === "done";

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setSlide((n) => (n + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [slide, ready]);

  const cur = SLIDES[slide];
  // Cadastro entra pela direita, login pela esquerda.
  const dir = /sign-up|forgot-password|reset-password/.test(pathname) ? "au-r" : "au-l";

  return (
    <div className="grid min-h-screen w-full grid-cols-1 gap-5 bg-neutral-950 p-5 text-white lg:h-screen lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Vitrine: tela do produto + frase */}
      {intro !== "done" && (
        <AuthIntro panelRef={panelRef} logoTargetRef={logoTargetRef} onExpand={() => setIntro("expand")} onDone={() => setIntro("done")} />
      )}
      <section
        ref={panelRef}
        className={`relative hidden min-h-0 overflow-hidden rounded-[36px] lg:block ${ready ? "bg-primary-600" : "bg-transparent"}`}
      >
        {ready && (
        <>
        <div aria-hidden className="absolute inset-x-10 top-10">
        <div className="au-float flex gap-4">
          <div className="flex w-[240px] flex-none flex-col gap-5 rounded-[28px] bg-neutral-950 p-4">
            <img src={hypeappLogo} alt="" className="ml-2 mt-1 h-8 w-auto self-start" />
            <div className="flex items-center gap-3 rounded-[20px] bg-white/8 p-3">
              <span className="grid size-10 place-items-center rounded-full bg-white text-[13px] font-bold text-neutral-950">V</span>
              <div className="leading-tight">
                <b className="block text-[14px] font-semibold">Sua marca</b>
                <small className="text-[12px] text-white/55">Proprietário</small>
              </div>
            </div>
            <ul className="flex flex-col gap-1.5">
              {NAV.map(([icon, label]) => (
                <li
                  key={label}
                  className={`flex items-center gap-3 rounded-full px-4 py-3 text-[14px] font-semibold transition-colors duration-500 ${label === cur.nav ? "bg-primary-600 text-white" : "text-white/70"}`}
                >
                  <Icon name={icon} color="currentColor" size={18} />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div key={slide} className="flex min-w-0 flex-1 flex-col gap-4">
            <MockMain slide={slide} />
          </div>
        </div>
        </div>

        <div className="absolute inset-x-10 bottom-10">
          <div key={slide} className="au-up">
            <h1 className="max-w-[15ch] text-[clamp(48px,4.4vw,64px)] font-semibold leading-[1] tracking-[-0.055em]">{cur.title}</h1>
            <p className="mt-5 max-w-[42ch] text-[17px] leading-relaxed text-white/80">{cur.text}</p>
          </div>

          <div className="mt-7 flex items-center gap-2" role="tablist" aria-label="Destaques">
            {SLIDES.map((_, k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={k === slide}
                aria-label={`Destaque ${k + 1}`}
                onClick={() => setSlide(k)}
                className={`relative h-1.5 overflow-hidden rounded-full bg-white/30 transition-all duration-500 ${k === slide ? "w-12" : "w-6 hover:bg-white/50"}`}
              >
                {k === slide && <i key={slide} className="au-fill absolute inset-0 rounded-full bg-white" />}
              </button>
            ))}
          </div>
        </div>
        </>
        )}
      </section>

      {/* Formulário */}
      <main
        className={`flex min-h-0 flex-col overflow-y-auto px-4 py-4 transition-opacity duration-700 sm:px-10 ${intro === "logo" ? "opacity-0" : "opacity-100"}`}
      >
        <header className="au-up flex justify-center pt-2 lg:pt-6" style={{ ["--d" as string]: "150ms" }}>
          <img ref={logoTargetRef} src={hypeappLogo} alt="HypeApp" className={`h-10 w-auto ${ready ? "" : "invisible"}`} />
        </header>

        <div
          key={pathname}
          className={[
            dir,
            "m-auto w-full max-w-[400px] py-10",
            "[&_h1]:!text-white [&_p]:!text-white/60 [&_label]:!text-white/80",
            "[&_.text-neutral-950]:!text-white [&_.text-neutral-700]:!text-white/75 [&_.text-neutral-500]:!text-white/60",
            "[&_div.bg-white]:!bg-white/10 [&_input]:!text-white [&_div.bg-white_svg]:!stroke-white/70",
            "[&_button[type=submit]]:!bg-primary-600 [&_button[type=submit]:hover]:!bg-primary-700",
          ].join(" ")}
        >
          <Outlet />
        </div>

        <footer className="pb-2 text-center text-[12.5px] text-white/40">
          © {new Date().getFullYear()} HypeApp · Você no Hype
        </footer>
      </main>
    </div>
  );
}
