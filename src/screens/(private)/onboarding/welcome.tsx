import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const Route = createFileRoute("/(private)/onboarding/welcome")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <div className="ob-done ob-screen">
      <span className="ob-done-badge" aria-hidden>
        <Icon name="Check" size={36} color="currentColor" />
      </span>

      <div className="flex flex-col gap-2.5">
        <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.04em] text-neutral-950">
          Bem-vindo(a) ao Hype{firstName ? `, ${firstName}` : ""}!
        </h1>

        <p className="text-[15px] leading-relaxed text-neutral-500">
          A partir de agora você tem acesso à nossa plataforma completa para
          conectar sua marca aos influenciadores certos.
        </p>
      </div>

      <Button className="ob-primary" onClick={() => navigate({ to: "/" })}>
        Começar agora
        <Icon name="ArrowRight" size={18} color="currentColor" />
      </Button>
    </div>
  );
}
