import { cn } from "@/lib/utils";

type PanelTone = "signal" | "secure" | "danger" | "warn" | "neutral";

const toneVar: Record<PanelTone, string> = {
  signal: "var(--signal)",
  secure: "var(--secure)",
  danger: "var(--danger)",
  warn: "var(--warn)",
  neutral: "var(--line-strong)",
};

/**
 * Instrument-panel container: square-cornered surface with HUD-style
 * corner brackets in an accent color. Purely presentational.
 */
export function Panel({
  tone = "neutral",
  bracketOpacity = 0.5,
  className,
  children,
}: {
  tone?: PanelTone;
  bracketOpacity?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bracket relative border border-[hsl(var(--line))] bg-[hsl(var(--surface-1))]",
        className
      )}
      style={
        {
          "--bracket-color": toneVar[tone],
          "--bracket-opacity": bracketOpacity,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function PanelEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[hsl(var(--text-dim))]",
        className
      )}
    >
      {children}
    </p>
  );
}
