import { useState, useRef, useEffect, type ComponentProps } from "react";

import { clsx } from "clsx";

import { Icon } from "@/components/ui/icon";

interface DropdownProps extends Omit<ComponentProps<"div">, "onChange"> {
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export function Dropdown({
  placeholder = "Selecione uma opção",
  options,
  value,
  onChange,
  disabled = false,
  ...props
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="w-full relative" ref={dropdownRef} {...props}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full h-11 flex items-center justify-between px-4 outline-none",
          isOpen && options.length > 0
            ? "rounded-t-2xl border-t border-r border-l border-neutral-200 shadow-md bg-white"
            : "rounded-2xl border border-neutral-200 bg-white",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          !disabled && "hover:bg-neutral-100 transition-colors duration-150"
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "whitespace-nowrap",
              selectedOption ? "text-neutral-700" : "text-neutral-400"
            )}
          >
            {selectedOption?.label ?? placeholder}
          </span>

          <Icon
            name="ChevronDown"
            color="#0a0a0a"
            size={16}
            className={clsx(
              "transition-transform duration-150",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {isOpen && options.length > 0 && (
        <div
          className={clsx(
            "absolute top-full w-full border-b border-r border-l border-neutral-200 overflow-hidden bg-white rounded-b-2xl z-10 shadow-md"
          )}
        >
          <div className="w-full border border-dashed border-neutral-200" />

          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={clsx(
                "w-full text-left text-neutral-700 py-2 px-4 hover:bg-neutral-100 transition-colors duration-150",
                value === option.value && "bg-neutral-100"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
