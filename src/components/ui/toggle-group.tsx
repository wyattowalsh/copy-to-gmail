import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../../lib/utils'

const toggleGroupVariants = cva(
  'inline-flex w-fit items-center justify-center gap-1 rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] p-1 text-[12px] font-[780] shadow-sm',
  {
    variants: {
      size: {
        default: 'min-h-10',
        sm: 'min-h-9',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

const toggleGroupItemVariants = cva(
  'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[color:var(--muted)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--paper)] disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-[color:var(--paper)] data-[state=on]:text-[color:var(--ink)] data-[state=on]:shadow-sm [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      size: {
        default: 'h-8',
        sm: 'h-7 px-2.5',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

type ToggleGroupProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroupPrimitive.Root
> &
  VariantProps<typeof toggleGroupVariants>

function ToggleGroup({ className, size, ...props }: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(toggleGroupVariants({ size }), className)}
      {...props}
    />
  )
}

type ToggleGroupItemProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroupPrimitive.Item
> &
  VariantProps<typeof toggleGroupItemVariants>

function ToggleGroupItem({ className, size, ...props }: ToggleGroupItemProps) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(toggleGroupItemVariants({ size }), className)}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
