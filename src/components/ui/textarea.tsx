import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-30 w-full resize-y rounded-md border-2 border-input bg-card px-4 py-3.5 text-base leading-relaxed transition-[border-color,box-shadow,background-color] duration-200 ease-brand outline-none placeholder:text-ink-400 hover:border-border-strong focus-visible:border-mint-600 focus-visible:ring-4 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted disabled:text-ink-400 aria-invalid:border-destructive aria-invalid:bg-destructive/5 aria-invalid:focus-visible:ring-destructive/20 dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
