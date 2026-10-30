import "./index.css";

import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { UpdateAvailable } from "./components/update-available";
import { BASE_PATH } from "./lib/utils/base-path";
import { routeTree } from "./routeTree.gen";

const router = createRouter({ 
  routeTree,
  basepath: BASE_PATH || "/",
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
      <UpdateAvailable />
    </StrictMode>
  );
}
