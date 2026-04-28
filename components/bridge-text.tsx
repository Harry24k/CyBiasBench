"use client";

export function BridgeText({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-muted-foreground/30 pl-5 my-16 py-2">
      <p className="text-base italic text-muted-foreground">{children}</p>
    </div>
  );
}
