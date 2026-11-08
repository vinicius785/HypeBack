import { type ComponentProps } from "react";

import { ChatDrawerButton } from "./chat-drawer";
import { NotificationsDropdown } from "./notifications-dropdown";
import { SupportButton } from "./support/support-button";

interface HeaderProps extends ComponentProps<"div"> {
  /** Só para páginas ainda não portadas; as portadas trazem o próprio título. */
  title?: string;
}

/** Ações do topo, à direita — suporte, divisória cinza, chat e sino. */
export function TopActions() {
  return (
    <>
      <SupportButton />
      <span className="top-sep" aria-hidden="true" />
      <ChatDrawerButton />
      <NotificationsDropdown />
    </>
  );
}

export function Header({ title, ...props }: HeaderProps) {
  return (
    <div className="pv" {...props}>
      <div className="top">
        {title ? (
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-.04em" }}>
            {title}
          </h1>
        ) : null}
        <div className="gap" />
        <TopActions />
      </div>
    </div>
  );
}
