import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { clsx } from "clsx";

import { Icon } from "@/components/ui/icon";
import { ErrorMessage } from "@/components/ui/error-message";

interface SelectProps extends Omit<ComponentProps<"div">, "onChange"> {
  label?: ReactNode;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  openUp?: boolean;
  isSearchable?: boolean;
}

const MENU_MAX_H = 240;
const MENU_GAP = 4;

export function Select({
  label,
  placeholder = "Selecione uma opção",
  options,
  value,
  onChange,
  error,
  disabled = false,
  openUp = false,
  isSearchable = false,
  ...props
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [menuRect, setMenuRect] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  const optionsSignature = useMemo(
    () => options.map((o) => o.value).join("\0"),
    [options],
  );

  useEffect(() => {
    setSearchTerm("");
  }, [optionsSignature]);

  const filteredOptions = useMemo(() => {
    if (!isSearchable || !searchTerm.trim()) {
      return options;
    }
    const term = searchTerm.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(term),
    );
  }, [options, searchTerm, isSearchable]);

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - r.bottom - MENU_GAP;
    const spaceAbove = r.top - MENU_GAP;
    const openUpward =
      openUp || (spaceBelow < 120 && spaceAbove > spaceBelow);
    const maxH = Math.min(
      MENU_MAX_H,
      openUpward ? spaceAbove : spaceBelow,
    );
    const width = r.width;
    let left = r.left;
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
    if (left < 8) left = 8;

    if (openUpward) {
      setMenuRect({
        left,
        width,
        bottom: vh - r.top + MENU_GAP,
        maxHeight: maxH,
      });
    } else {
      setMenuRect({
        left,
        width,
        top: r.bottom + MENU_GAP,
        maxHeight: maxH,
      });
    }
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuRect(null);
      return;
    }
    updateMenuPosition();
  }, [isOpen, openUp, filteredOptions.length, options.length]);

  useEffect(() => {
    if (!isOpen) return;

    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [isOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const t = event.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setIsOpen(false);
      setSearchTerm("");
    };

    if (isOpen) {
      document.addEventListener("mousedown", handlePointerDown);
      if (isSearchable && searchInputRef.current) {
        const id = window.setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
        return () => {
          clearTimeout(id);
          document.removeEventListener("mousedown", handlePointerDown);
        };
      }
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen, isSearchable]);

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue);
    setIsOpen(false);
    setSearchTerm("");
  };

  const menuContent =
    isOpen && menuRect ? (
      <div
        ref={menuRef}
        data-select-dropdown=""
        className="fixed z-[9999] rounded-3xl bg-neutral-100 border border-neutral-200 shadow-lg overflow-hidden flex flex-col"
        style={{
          left: menuRect.left,
          width: menuRect.width,
          ...(menuRect.top != null ? { top: menuRect.top } : {}),
          ...(menuRect.bottom != null ? { bottom: menuRect.bottom } : {}),
          maxHeight: menuRect.maxHeight,
        }}
      >
        {isSearchable && (
          <div className="p-2 border-b border-neutral-200 shrink-0">
            <div className="relative">
              <Icon
                name="Search"
                color="#737373"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="w-full h-9 pl-9 pr-3 bg-white rounded-2xl border border-neutral-200 text-sm text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
        <div
          className="overflow-y-auto min-h-0 flex-1"
          style={{ maxHeight: isSearchable ? "calc(100% - 52px)" : "100%" }}
        >
          {filteredOptions.length === 0 ? (
            <div className="py-4 px-4 text-center text-sm text-neutral-500">
              Nenhuma opção encontrada
            </div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={clsx(
                  "w-full text-left text-neutral-950 py-2 px-4 hover:bg-neutral-200/70 transition-colors duration-150",
                  value === option.value && "bg-neutral-200/70",
                )}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className="w-full flex flex-col gap-1 relative" ref={rootRef} {...props}>
      {label && (
        <label htmlFor={props.id} className="text-neutral-950 font-medium">
          {label}
        </label>
      )}

      <div className="w-full relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={clsx(
            "w-full h-11 bg-neutral-100 flex items-center justify-between px-4 outline-none focus-within:bg-neutral-200/70 rounded-3xl",
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          )}
        >
          <span
            className={clsx(
              "whitespace-nowrap truncate pr-2",
              selectedOption ? "text-neutral-950" : "text-neutral-400",
            )}
          >
            {selectedOption?.label ?? placeholder}
          </span>

          <Icon
            name="ChevronDown"
            color="#0a0a0a"
            size={16}
            className={clsx(
              "shrink-0 transition-transform duration-150",
              isOpen && "rotate-180",
            )}
          />
        </button>
      </div>

      {typeof document !== "undefined" && menuContent
        ? createPortal(menuContent, document.body)
        : null}

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
