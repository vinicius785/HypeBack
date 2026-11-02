import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(private)/(admin)/admin/workspaces")({
  component: Outlet,
});
