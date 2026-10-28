import type { ComponentProps, HTMLInputTypeAttribute } from "react";

import { ErrorMessage } from "@/components/ui/error-message";

interface InputProps extends ComponentProps<"input"> {
  label?: string;
  icon?: React.ReactNode;
  type?: HTMLInputTypeAttribute;
  error?: string;
}

export function Input({
  label,
  icon,
  error,
  type = "text",
  onChange,
  ...props
}: InputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Prevenir números negativos em inputs do tipo number
    if (type === "number") {
      // Permite campo vazio ou apenas o sinal de menos sendo removido
      if (value === "" || value === "-") {
        if (onChange) {
          const newEvent = { ...e, target: { ...e.target, value: "" } };
          onChange(newEvent as React.ChangeEvent<HTMLInputElement>);
        }
        return;
      }
      
      const numValue = parseFloat(value);
      
      // Se for negativo ou NaN, não atualiza
      if (isNaN(numValue) || numValue < 0) {
        return;
      }
    }
    
    // Validar datas para inputs do tipo date ou datetime-local
    if ((type === "date" || type === "datetime-local") && value) {
      const min = props.min;
      const max = props.max;
      
      if (min) {
        // Comparar strings diretamente (formato ISO: YYYY-MM-DD ou YYYY-MM-DDTHH:mm)
        if (value < min) {
          // Data menor que o mínimo - não permite a mudança
          // A mensagem de erro será exibida através da prop error
          return;
        }
      }
      
      if (max) {
        // Comparar strings diretamente (formato ISO: YYYY-MM-DD ou YYYY-MM-DDTHH:mm)
        if (value > max) {
          // Data maior que o máximo - não permite a mudança
          // A mensagem de erro será exibida através da prop error
          return;
        }
      }
    }
    
    // Chamar o onChange original se fornecido
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={props.id} className="text-[13px] font-semibold text-neutral-700">
          {label}
        </label>
      )}

      <div className="w-full h-[52px] rounded-full bg-white flex items-center justify-between gap-2 px-5 ring-2 ring-transparent focus-within:ring-primary-600 transition-all duration-150">
        <input
          type={type}
          className="w-full h-full rounded-full outline-none placeholder:text-neutral-400 text-neutral-950 bg-transparent"
          {...props}
          onChange={handleChange}
          min={type === "number" ? "0" : undefined}
        />

        {icon}
      </div>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
