"use client";

export function BridgeText({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-12 sm:my-20 mx-auto max-w-2xl text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-5 sm:mb-7 h-px w-12 bg-foreground/30"
      />
      <p className="font-serif italic text-xl sm:text-2xl text-foreground/85 leading-snug">
        {children}
      </p>
      <div
        aria-hidden="true"
        className="mx-auto mt-5 sm:mt-7 h-px w-12 bg-foreground/30"
      />
    </div>
  );
}
