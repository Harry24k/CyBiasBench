"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CollapsibleProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export function Collapsible({
  trigger,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  triggerClassName,
  contentClassName,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleToggle = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex items-center gap-2 text-left w-full text-sm font-medium text-foreground hover:text-primary transition-colors",
          triggerClassName,
        )}
        aria-expanded={open}
      >
        <span className={cn("inline-block transition-transform", open ? "rotate-90" : "rotate-0")}>
          ▶
        </span>
        <span>{trigger}</span>
      </button>
      {open && (
        <div className={cn("mt-2", contentClassName)}>{children}</div>
      )}
    </div>
  );
}

interface InlineCollapsibleProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

// For rows: show the panel only when open. Used so the parent controls state.
export function InlineCollapsible({ open, children, className }: InlineCollapsibleProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // ensure layout settles
  }, [open]);
  if (!open) return null;
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
