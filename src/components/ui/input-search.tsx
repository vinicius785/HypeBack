import type { ComponentProps } from "react";

interface InputProps extends ComponentProps<"input"> {
  icon?: React.ReactNode;
}

export function InputSearch({ icon, ...props }: InputProps) {
  return (
    <div className="w-full h-11 rounded-2xl bg-white border border-neutral-200 flex items-center gap-2 px-4 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500/30 transition-all duration-150">
      {icon}

      <input
        type="text"
        className="w-full h-full rounded-2xl outline-none placeholder:text-neutral-400 text-neutral-950 bg-transparent"
        {...props}
      />
    </div>
  );
}
