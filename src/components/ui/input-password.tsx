import { useState, type ComponentProps } from "react";

import { Icon } from "@/components/ui/icon";
import { ErrorMessage } from "@/components/ui/error-message";

interface InputPasswordProps extends ComponentProps<"input"> {
  label?: string;
  error?: string;
}

export function InputPassword({ label, error, ...props }: InputPasswordProps) {
  const [visiblePassword, setVisiblePassword] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={props.id} className="text-[13px] font-semibold text-neutral-700">
          {label}
        </label>
      )}

      <div className="w-full h-[52px] rounded-full bg-white flex items-center justify-between px-5 ring-2 ring-transparent focus-within:ring-primary-600 transition-all duration-150">
        <input
          type={visiblePassword ? "text" : "password"}
          className="w-full h-full bg-transparent outline-none placeholder:text-neutral-400 text-neutral-950"
          {...props}
        />

        <Icon
          onClick={() => setVisiblePassword(!visiblePassword)}
          name={visiblePassword ? "EyeOff" : "Eye"}
          color="#0a0a0a"
          size={16}
          className="cursor-pointer shrink-0"
        />
      </div>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
