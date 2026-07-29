import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "danger" | "neutral" | "warning";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  danger: "bg-foreground text-background ring-foreground",
  warning: "bg-muted text-foreground ring-border font-semibold",
  neutral: "bg-white/5 text-muted-foreground ring-white/10",
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
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
