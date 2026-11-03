import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { logout } from "@/shared/services/auth";
import { clearClientSession } from "@/lib/utils/session";
import { currentOnboardingStep, onboardingGroup, onboardingSteps } from "@/lib/onboarding/flow";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspaces } from "@/hooks/use-workspaces";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";

export const Route = createFileRoute("/(private)/onboarding")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: workspaces } = useWorkspaces();

  const { mutate: logoutMutation, isPending: isLoggingOut } = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearClientSession(queryClient);
      setUser(null);
      navigate({ to: "/sign-in", replace: true });
    },
    onError: () => {
      clearClientSession(queryClient);
      setUser(null);
      navigate({ to: "/sign-in", replace: true });
    },
  });

  const group = onboardingGroup(location.pathname);

  return (
    <OnboardingShell
      group={group}
      steps={onboardingSteps(group)}
      current={currentOnboardingStep(location.pathname, location.search as { etapa?: unknown })}
      user={user}
      canLeave={(workspaces?.length ?? 0) > 0}
      onLogout={() => logoutMutation()}
      isLoggingOut={isLoggingOut}
    >
      <Outlet />
    </OnboardingShell>
  );
}
