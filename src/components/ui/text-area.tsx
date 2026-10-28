import { forwardRef, type ComponentProps } from "react";

import { clsx } from "clsx";
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from "react-textarea-autosize";

import { ErrorMessage } from "@/components/ui/error-message";

interface TextareaProps extends ComponentProps<"textarea"> {
  label: string;
  labelColor?: string;
  error?: string;
  style?: TextareaAutosizeProps["style"];
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, labelColor = "text-neutral-950", error, style, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={props.id} className={clsx(labelColor, "font-medium")}>
            {label}
          </label>
        )}

        <TextareaAutosize
          ref={ref}
          className={clsx(
            "w-full min-h-11 rounded-3xl py-3 px-4 bg-neutral-100 text-neutral-950 outline-none resize-none overflow-hidden focus-within:bg-neutral-200/70 transition-colors duration-150 placeholder:text-neutral-400"
          )}
          style={style}
          {...props}
        />

        {error && <ErrorMessage message={error} />}
      </div>
    );
  }
);
