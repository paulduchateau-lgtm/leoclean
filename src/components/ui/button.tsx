import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Boutons du design system.
 *
 * Toute action est une pilule : c'est la forme la plus reconnaissable du
 * système, et la seule admise pour un élément cliquable. Les gabarits partent
 * de 48 px — un bouton de conversion se touche au pouce, pas au curseur — et
 * la menthe pleine porte du texte encre, jamais du blanc : à 400 elle est trop
 * claire pour tenir le contraste.
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-full border-2 border-transparent bg-clip-padding text-center font-bold tracking-[-0.005em] whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-brand outline-none select-none focus-visible:ring-4 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:border-transparent disabled:bg-muted disabled:text-ink-400 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.15em]",
  {
    variants: {
      variant: {
        /* Un écran, un seul bouton menthe. */
        default:
          "bg-primary text-primary-foreground shadow-xs hover:-translate-y-px hover:bg-mint-500 hover:shadow-mint active:translate-y-0 active:scale-[0.985] active:bg-mint-600 active:shadow-xs",
        secondary:
          "bg-ink-900 text-white hover:-translate-y-px hover:bg-ink-800 hover:shadow-md active:translate-y-0 active:scale-[0.985] active:bg-ink-950 dark:bg-ink-100 dark:text-ink-950 dark:hover:bg-white",
        outline:
          "border-border bg-card text-foreground shadow-xs hover:-translate-y-px hover:border-mint-400 hover:bg-mint-50 active:translate-y-0 active:scale-[0.985] active:bg-mint-100",
        ghost:
          "text-mint-700 hover:bg-mint-50 active:scale-[0.985] active:bg-mint-100",
        destructive:
          "bg-destructive text-white hover:-translate-y-px hover:bg-destructive-hover active:translate-y-0 active:scale-[0.985]",
        link: "text-mint-700 underline decoration-mint-300 decoration-2 underline-offset-4 hover:decoration-mint-600",
      },
      size: {
        default: "h-12 gap-2 px-6 text-base",
        xs: "h-8 gap-1.5 px-3.5 text-[0.8125rem]",
        sm: "h-10 gap-1.5 px-[1.125rem] text-sm",
        lg: "h-14 gap-2 px-8 text-lg",
        xl: "h-16 gap-2.5 px-10 text-xl",
        icon: "size-11",
        "icon-xs": "size-8",
        "icon-sm": "size-9",
        "icon-lg": "size-13",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
