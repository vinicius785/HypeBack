import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";
import { clsx } from "clsx";

interface CheckboxProps extends RadixCheckbox.CheckboxProps {}

export function Checkbox({ ...props }: CheckboxProps) {
  return (
    <RadixCheckbox.Root
      className={clsx(
        "size-5 shrink-0 rounded border border-neutral-200 flex items-center justify-center transition-colors hover:border-neutral-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2",
        "data-[state=checked]:bg-secondary-500 data-[state=checked]:border-secondary-500"
      )}
      {...props}
    >
      <RadixCheckbox.Indicator
        className={clsx("flex items-center justify-center text-neutral-950")}
      >
        <CheckIcon className="size-4" strokeWidth={2} />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
