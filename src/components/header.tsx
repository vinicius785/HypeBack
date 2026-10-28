import { type ComponentProps } from "react";

import { ChatDrawerButton } from "./chat-drawer";
import { NotificationsDropdown } from "./notifications-dropdown";

interface HeaderProps extends ComponentProps<"div"> {
  /** Só para páginas ainda não portadas; as portadas trazem o próprio título. */
  title?: string;
}

/** Ações do topo — chat e sino redondos, como no protótipo. */
export function TopActions() {
  return (
    <>
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
