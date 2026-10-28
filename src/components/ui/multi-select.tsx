import type { ComponentProps } from "react";
import Select, { type MultiValue, type StylesConfig } from "react-select";

import { ErrorMessage } from "@/components/ui/error-message";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps extends Omit<ComponentProps<"div">, "onChange"> {
  label?: string;
  placeholder?: string;
  options: MultiSelectOption[];
  value?: string[];
  onChange?: (values: string[]) => void;
  error?: string;
  disabled?: boolean;
  isSearchable?: boolean;
  menuPlacement?: "auto" | "bottom" | "top";
}

const customStyles: StylesConfig<MultiSelectOption, true> = {
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    borderRadius: "24px",
    border: "none",
    backgroundColor: state.isFocused ? "#e5e5e5" : "#f5f5f5",
    boxShadow: "none",
    "&:hover": {
      backgroundColor: "#e5e5e5",
    },
  }),
  placeholder: (base) => ({
    ...base,
    color: "#a3a3a3",
  }),
  input: (base) => ({
    ...base,
    color: "#0a0a0a",
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "#e5e5e5",
    borderRadius: "16px",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#0a0a0a",
    padding: "4px 8px",
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#0a0a0a",
    borderRadius: "0 16px 16px 0",
    "&:hover": {
      backgroundColor: "#d4d4d4",
      color: "#0a0a0a",
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: "24px",
    backgroundColor: "#f5f5f5",
    border: "1px solid #e5e5e5",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    overflow: "hidden",
  }),
  menuList: (base) => ({
    ...base,
    padding: "4px",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#e5e5e5"
      : state.isFocused
        ? "#e5e5e5"
        : "transparent",
    color: "#0a0a0a",
    borderRadius: "16px",
    margin: "2px",
    padding: "8px 12px",
    "&:active": {
      backgroundColor: "#d4d4d4",
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: "#737373",
  }),
};

export function MultiSelect({
  label,
  placeholder = "Selecione uma ou mais opções",
  options,
  value = [],
  onChange,
  error,
  disabled = false,
  isSearchable = true,
  menuPlacement = "auto",
  ...props
}: MultiSelectProps) {
  const selectedOptions = options.filter((option) => value.includes(option.value));

  const handleChange = (selected: MultiValue<MultiSelectOption>) => {
    const values = selected.map((option) => option.value);
    onChange?.(values);
  };

  return (
    <div className="w-full flex flex-col gap-1" {...props}>
      {label && (
        <label className="text-neutral-950 font-medium">{label}</label>
      )}

      <Select<MultiSelectOption, true>
        isMulti
        isSearchable={isSearchable}
        isDisabled={disabled}
        options={options}
        value={selectedOptions}
        onChange={handleChange}
        placeholder={placeholder}
        styles={customStyles}
        noOptionsMessage={() => "Nenhuma opção encontrada"}
        classNamePrefix="react-select"
        menuPlacement={menuPlacement}
      />

      {error && <ErrorMessage message={error} />}
    </div>
  );
}

