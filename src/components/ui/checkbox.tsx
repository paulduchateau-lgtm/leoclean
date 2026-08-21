"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-6 shrink-0 items-center justify-center rounded-xs border-[2.5px] border-border-strong bg-card transition-[background-color,border-color,box-shadow] duration-200 ease-brand outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 hover:border-teal-500 focus-visible:border-teal-600 focus-visible:ring-4 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-teal-500 data-checked:border-teal-500 data-checked:bg-teal-400 data-checked:text-ink-900",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-4 [&>svg]:stroke-[3]"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
