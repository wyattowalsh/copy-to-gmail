import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex min-w-0 items-center justify-center gap-2 rounded-[var(--control-radius)] border text-sm font-semibold leading-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)] disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[var(--shadow-control)] hover:bg-[color:var(--primary-strong)]',
        secondary:
          'border-[color:var(--line-strong)] bg-[color:var(--paper)] text-[color:var(--ink)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]',
        ghost:
          'border-transparent bg-transparent text-[color:var(--muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--ink)]',
      },
      size: {
        default: 'min-h-11 px-4',
        sm: 'min-h-9 px-3 text-xs',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'secondary',
    },
  },
)

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, ...props }, ref) => (
    <button
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ size, variant }), className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'

export { Button }
