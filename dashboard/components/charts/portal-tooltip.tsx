"use client";

import { useMounted } from "@/lib/use-mounted";

import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * PortalTooltip — renders its `content` into document.body so it always sits
 * above any parent overflow / clip. The wrapped trigger element controls
 * visibility on hover (mouse) and focus (keyboard). Position is anchored to
 * the trigger's bounding rect and re-measured on scroll/resize.
 */
export function PortalTooltip({
  content,
  children,
  side = "bottom",
  align = "start",
  width = 360,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end" | "center";
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const mounted = useMounted();


  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      const margin = 8;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1500;
      // Vertical anchor: below trigger by default, above if not enough room.
      const tooltipMaxHeight = 320;
      const top =
        side === "top"
          ? r.top - tooltipMaxHeight - margin
          : r.bottom + margin;
      // Horizontal anchor: respect alignment, then clamp to viewport.
      let left: number;
      if (align === "end") left = r.right - width;
      else if (align === "center") left = r.left + r.width / 2 - width / 2;
      else left = r.left;
      left = Math.max(8, Math.min(left, vw - width - 8));
      setCoords({ top, left });
    };
    update();
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, side, align, width]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-block"
      >
        {children}
      </span>
      {mounted && open
        ? createPortal(
            <div
              role="tooltip"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                width,
                zIndex: 1000,
                pointerEvents: "none",
              }}
              className={cn(
                "rounded-lg border border-border bg-card shadow-2xl p-4 text-sm text-foreground",
                className,
              )}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
