import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

/**
 * @typedef {Object} ButtonProps
 * @property {string} [className]
 * @property {'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'} [variant]
 * @property {'default' | 'sm' | 'lg' | 'icon'} [size]
 * @property {boolean} [asChild]
 * @property {React.ReactNode} [children]
 */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 backdrop-blur-sm",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 text-white shadow-[0_15px_30px_rgba(79,141,246,0.35)] hover:shadow-[0_20px_40px_rgba(79,141,246,0.4)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-white/50 bg-white/70 text-foreground shadow-[0_10px_25px_rgba(15,23,42,0.08)] hover:bg-white/90",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_12px_25px_rgba(15,23,42,0.08)] hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-2xl px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/** @type {React.ForwardRefExoticComponent<ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement> & React.RefAttributes<HTMLButtonElement>>} */
const Button = React.forwardRef(
  /** @param {ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>} props */
  /** @param {React.Ref<HTMLButtonElement>} ref */
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props} />
    );
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
