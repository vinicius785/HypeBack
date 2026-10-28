import { clsx } from "clsx";

interface TabsProps {
  tabs: Array<{ id: string; label: string; count?: number }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

/** Barra de abas em pílula (ativa em preto), no estilo do backoffice novo. */
export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div
      role="tablist"
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-white p-[5px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const on = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              "inline-flex h-[42px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-300",
              on
                ? "bg-neutral-950 text-white"
                : "text-neutral-500 hover:text-neutral-950",
            )}
          >
            {tab.label}
            {tab.count ? (
              <em className="min-w-5 rounded-full bg-primary-600 px-[7px] py-0.5 text-center text-[11.5px] font-bold not-italic text-white">
                {tab.count}
              </em>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
