import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

import authLayoutImage from "@/assets/images/auth-layout-image.png";
import hypeappLogo from "@/assets/images/hypeapp-logo.png";

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

  return (
    <div className="grid h-screen w-full grid-cols-1 gap-5 bg-canvas p-5 lg:grid-cols-2">
      <div className="flex min-h-0 items-center justify-center overflow-y-auto px-6 py-8">
        <Outlet />
      </div>

      <aside className="relative hidden min-h-0 flex-col justify-between overflow-hidden rounded-[40px] bg-neutral-950 p-12 text-white lg:flex">
        <img src={hypeappLogo} alt="HypeApp" className="h-9 w-auto self-start" />

        <div className="relative flex min-h-0 flex-1 flex-col justify-end gap-8 pt-10">
          <div>
            <small className="text-[13.5px] text-white/60">Para marcas</small>
            <h2 className="mt-2 max-w-[16ch] text-[40px] font-semibold leading-[1.05] tracking-[-0.05em]">
              Conecte a sua marca aos criadores certos.
            </h2>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[32px]">
            <img
              src={authLayoutImage}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
