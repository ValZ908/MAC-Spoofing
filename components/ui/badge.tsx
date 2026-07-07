import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "danger" | "neutral" | "warning";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  danger: "bg-red-500/10 text-red-400 ring-red-500/20",
  warning: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  neutral: "bg-slate-500/10 text-slate-400 ring-slate-500/20",
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
