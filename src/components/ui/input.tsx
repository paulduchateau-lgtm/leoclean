import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

/*
 * Champ de saisie du design system : 52 px de haut, bordure de 2 px, coins à
 * 14 px. Le halo menthe au focus fait 4 px — assez épais pour se voir sur un
 * écran de téléphone en plein soleil.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-13 w-full min-w-0 rounded-md border-2 border-input bg-card px-4 py-3.5 text-base transition-[border-color,box-shadow,background-color] duration-200 ease-brand outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-400 hover:border-border-strong focus-visible:border-mint-600 focus-visible:ring-4 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted disabled:text-ink-400 aria-invalid:border-destructive aria-invalid:bg-destructive/5 aria-invalid:focus-visible:ring-destructive/20 dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
