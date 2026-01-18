import React, { useRef } from 'react'
import { cn } from '../../lib/utils'

interface CustomScrollbarProps {
  children: React.ReactNode
  direction?: 'horizontal' | 'vertical' | 'both'
  className?: string
}

/**
 * CustomScrollbar Component
 * 
 * Provides a custom-styled scrollbar wrapper for scrollable content.
 * Supports both horizontal and vertical scrolling with custom styling.
 */
export function CustomScrollbar({
  children,
  direction = 'horizontal',
  className,
}: CustomScrollbarProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const scrollbarClasses = cn(
    'custom-scrollbar',
    direction === 'horizontal' && 'overflow-x-auto overflow-y-hidden',
    direction === 'vertical' && 'overflow-y-auto overflow-x-hidden',
    direction === 'both' && 'overflow-auto',
    className
  )

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={cn(
          scrollbarClasses,
          // Custom scrollbar styles using CSS classes
          // Horizontal scrollbar height
          direction === 'horizontal' && '[&::-webkit-scrollbar]:h-2',
          direction === 'horizontal' && '[&::-webkit-scrollbar]:w-auto',
          // Vertical scrollbar width
          direction === 'vertical' && '[&::-webkit-scrollbar]:w-2',
          direction === 'vertical' && '[&::-webkit-scrollbar]:h-auto',
          // Both directions
          direction === 'both' && '[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2',
          // Track styles
          '[&::-webkit-scrollbar-track]:bg-transparent',
          // Thumb styles
          '[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30',
          '[&::-webkit-scrollbar-thumb]:rounded-full',
          '[&::-webkit-scrollbar-thumb]:transition-colors',
          'hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50'
        )}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent',
        }}
      >
        {children}
      </div>
    </div>
  )
}
