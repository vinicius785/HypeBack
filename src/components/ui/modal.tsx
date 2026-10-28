import { clsx } from "clsx";
import { Icon } from "@/components/ui/icon";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Largura do painel (ex.: Figma convite ~800px) */
  panelClassName?: string;
}

export function Modal({ title, onClose, children, panelClassName }: ModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const handleCloseClick = () => {
    onClose();
  };

  return (
    <div 
      className="w-full h-full bg-black/60 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={clsx(
          "w-full bg-white p-8 rounded-[32px] max-h-[90vh] overflow-y-auto shadow-xl",
          panelClassName ?? "max-w-4xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-semibold text-neutral-950 tracking-[-0.03em]">{title}</h1>

          <button
            type="button"
            onClick={handleCloseClick}
            className="grid size-10 place-items-center rounded-full bg-canvas hover:bg-neutral-200 transition-colors"
            aria-label="Fechar"
          >
            <Icon name="X" size={20} color="#525252" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
