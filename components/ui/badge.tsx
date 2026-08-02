import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "danger" | "neutral" | "warning";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-[hsl(var(--secure)/0.1)] text-[hsl(var(--secure))] ring-[hsl(var(--secure)/0.3)]",
  danger: "bg-[hsl(var(--danger)/0.1)] text-[hsl(var(--danger))] ring-[hsl(var(--danger)/0.3)]",
  warning: "bg-[hsl(var(--warn)/0.1)] text-[hsl(var(--warn))] ring-[hsl(var(--warn)/0.3)]",
  neutral: "bg-[hsl(var(--surface-3))] text-[hsl(var(--text-muted))] ring-[hsl(var(--line-strong))]",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
