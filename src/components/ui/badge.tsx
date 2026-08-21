import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-6.5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 text-xs font-bold tracking-[0.01em] whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        /* Sarcelle claire : l'étiquette courante, celle qui ne crie pas. */
        default: "bg-teal-100 text-teal-800 [a]:hover:bg-teal-200",
        /* Encre pleine : la seule étiquette qui tranche sur une photo. */
        secondary: "bg-ink-900 text-white [a]:hover:bg-ink-800",
        peach: "bg-papaya-100 text-papaya-800 [a]:hover:bg-papaya-200",
        /* Citron : réservé aux moments de joie — notes, promos, récompenses. */
        lemon: "bg-pineapple-100 text-pineapple-700 [a]:hover:bg-pineapple-200",
        sky: "bg-sky-100 text-info-dark [a]:hover:bg-sky-200",
        success: "bg-success-bg text-success-dark",
        warning: "bg-warning-bg text-warning-dark",
        destructive:
          "bg-error-bg text-error-dark focus-visible:ring-destructive/20",
        outline:
          "border-[1.5px] border-border bg-card text-ink-700 [a]:hover:bg-muted",
        ghost: "hover:bg-muted hover:text-muted-foreground",
        link: "text-teal-700 underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
