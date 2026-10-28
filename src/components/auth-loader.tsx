import { useRouterState } from "@tanstack/react-router";

import { useCurrentUser } from "@/hooks/use-current-user";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface AuthLoaderProps {
  children: React.ReactNode;
}

const PUBLIC_CAMPAIGN_INVITE_PATH =
  /^\/campaigns\/[^/]+\/invite\/?$/;

export const AuthLoader = ({ children }: AuthLoaderProps) => {
  const { isLoading } = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const skipAuthGate = PUBLIC_CAMPAIGN_INVITE_PATH.test(pathname);

  if (!skipAuthGate && isLoading) {
    return <LoadingSpinner message="Carregando..." />;
  }

  return <>{children}</>;
};
