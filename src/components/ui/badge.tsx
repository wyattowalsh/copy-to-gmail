import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex min-w-0 items-center justify-center rounded-[var(--chip-radius)] border px-2.5 py-1 text-xs font-semibold leading-none',
  {
    variants: {
      tone: {
        neutral:
          'border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--muted)]',
        primary:
          'border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line))] bg-[color:color-mix(in_srgb,var(--primary)_10%,var(--paper))] text-[color:var(--primary)]',
        success:
          'border-[color:color-mix(in_srgb,var(--green)_34%,var(--line))] bg-[color:color-mix(in_srgb,var(--green)_12%,var(--paper))] text-[color:var(--green)]',
        warning:
          'border-[color:color-mix(in_srgb,var(--amber)_38%,var(--line))] bg-[color:color-mix(in_srgb,var(--amber)_14%,var(--paper))] text-[color:var(--amber)]',
        error:
          'border-[color:color-mix(in_srgb,var(--red)_34%,var(--line))] bg-[color:color-mix(in_srgb,var(--red)_12%,var(--paper))] text-[color:var(--red)]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>

function Badge({ className, tone, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  )
}

export { Badge }
