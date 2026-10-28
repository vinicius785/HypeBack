import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/(private)/onboarding/welcome")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="max-w-lg w-full flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-medium text-neutral-950 whitespace-nowrap">
          Bem-vindo(a) ao Hype, {user?.name}! 🎉
        </h1>

        <p className="text-lg text-neutral-600 text-center">
          A partir de agora você tem acesso à nossa plataforma completa para
          conectar sua marca aos influenciadores certos.
        </p>
      </div>

      <Button className="max-w-72 min-w-max" onClick={() => navigate({ to: "/" })}>
        <p className="text-neutral-50 font-semibold">Começar agora</p>
      </Button>
    </div>
  );
}
