import { useRef, useState, useEffect } from "react";

import {
  formatDateToDisplay,
  parseDisplayDateToISO,
} from "@/shared/utils/date-validations";

import { Icon } from "@/components/ui/icon";
import { ErrorMessage } from "@/components/ui/error-message";

interface InputDateProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  error?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

/**
 * Aplica máscara DD/MM/AAAA enquanto o usuário digita
 */
function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function InputDate({
  label,
  value,
  onChange,
  min,
  max,
  error,
  placeholder = "DD/MM/AAAA",
  id,
  disabled,
}: InputDateProps) {
  const [displayValue, setDisplayValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value ? formatDateToDisplay(value) : "");
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const masked = maskDateInput(raw);
    setDisplayValue(masked);
    const iso = parseDisplayDateToISO(masked);
    if (iso) {
      let valid = true;
      if (min && iso < min) valid = false;
      if (max && iso > max) valid = false;
      if (valid) onChange(iso);
    } else if (masked.replace(/\D/g, "").length === 0) {
      onChange("");
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    setDisplayValue(value ? formatDateToDisplay(value) : "");
  };

  const handleFocus = () => setIsFocused(true);

  const handlePickerClick = () => {
    if (disabled) return;
    pickerRef.current?.showPicker?.();
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    setDisplayValue(v ? formatDateToDisplay(v) : "");
  };

  const display = isFocused ? displayValue : value ? formatDateToDisplay(value) : "";

  return (
    <div className="flex flex-col gap-1 relative">
      {label && (
        <label htmlFor={id} className="text-neutral-950 font-medium">
          {label}
        </label>
      )}

      <div className="w-full h-11 rounded-2xl bg-neutral-100 flex items-center justify-between gap-2 px-4 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500/30 border border-transparent transition-all duration-150">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onClick={handlePickerClick}
          disabled={disabled}
          className="w-full h-full rounded-2xl outline-none placeholder:text-neutral-400 text-neutral-950 bg-transparent min-w-0 cursor-pointer"
        />

        <input
          ref={pickerRef}
          type="date"
          value={value || ""}
          onChange={handlePickerChange}
          min={min}
          max={max}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />

        <button
          type="button"
          onClick={handlePickerClick}
          disabled={disabled}
          className="shrink-0 p-1 rounded-full hover:bg-neutral-200/70 transition-colors"
          title="Abrir calendário"
          aria-label="Abrir calendário"
        >
          <Icon name="Calendar" size={18} color="#525252" />
        </button>
      </div>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
