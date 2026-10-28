import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";

import { AuthProvider } from "@/contexts/auth-context";

import { Toaster } from "@/components/ui/sonner";
import { AuthLoader } from "@/components/auth-loader";
import { NotFoundPage } from "@/components/not-found-page";

const queryClient = new QueryClient();

const RootLayout = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AuthLoader>
        <Outlet />
      </AuthLoader>
    </AuthProvider>

    <Toaster
      position="top-right"
      expand
      duration={5000}
      closeButton
      visibleToasts={4}
      style={{ zIndex: 99999 }}
      toastOptions={{
        className: "shadow-lg border border-neutral-200 rounded-xl bg-green-500 text-black",
      }}
    />
  </QueryClientProvider>
);

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});
