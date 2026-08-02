type SignalRingState = "secure" | "warning" | "danger";

const stateColor: Record<SignalRingState, string> = {
  secure: "var(--signal)",
  warning: "var(--warn)",
  danger: "var(--danger)",
};

/**
 * Radar/sonar-style status ring. Sweeps continuously while "secure"
 * (actively monitoring), pulses while "danger", sits static/dim
 * while "warning" (monitoring offline). Purely presentational —
 * takes a state string, renders nothing else.
 */
export function SignalRing({
  state,
  icon,
  size = 88,
}: {
  state: SignalRingState;
  icon: React.ReactNode;
  size?: number;
}) {
  const color = stateColor[state];

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      {/* faint track */}
      <div
        className="absolute inset-0 rounded-full border"
        style={{ borderColor: "hsl(var(--line-strong))" }}
      />
      {/* sweeping arc — only animates while actively secure/monitoring */}
      <div
        className={state === "secure" ? "absolute inset-0 animate-sweep" : "absolute inset-0"}
        style={{
          background: `conic-gradient(from 0deg, hsl(${color}) 0deg, hsl(${color}) 55deg, transparent 65deg, transparent 360deg)`,
          WebkitMaskImage:
            "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
          maskImage:
            "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
          borderRadius: "9999px",
          opacity: state === "warning" ? 0.25 : 0.9,
        }}
      />
      {/* danger pulse ring */}
      {state === "danger" && (
        <div
          className="absolute inset-0 animate-pulse-ring rounded-full border-2"
          style={{ borderColor: `hsl(${color})` }}
        />
      )}
      {/* center face */}
      <div
        className="absolute inset-[10px] flex items-center justify-center rounded-full border"
        style={{
          borderColor: `hsl(${color} / 0.35)`,
          background: "hsl(var(--surface-2))",
          boxShadow: `inset 0 0 20px hsl(${color} / 0.12)`,
        }}
      >
        <div style={{ color: `hsl(${color})` }}>{icon}</div>
      </div>
    </div>
  );
}
