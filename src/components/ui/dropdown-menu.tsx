import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import type * as React from 'react'

import { cn } from '../../lib/utils'

function DropdownMenu({
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = 'end',
  collisionPadding = 12,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn('tool-menu-panel', className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn('tool-menu-label', className)}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn('tool-menu-item', className)}
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn('tool-menu-item tool-menu-radio-item', className)}
      {...props}
    >
      <span className="tool-menu-radio-mark" aria-hidden="true">
        <DropdownMenuPrimitive.ItemIndicator />
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('tool-menu-separator', className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
