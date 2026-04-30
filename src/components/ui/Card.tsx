import { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  className = "",
  variant = "default",
  style,
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "fairway";
  style?: CSSProperties;
}) {
  const base = variant === "fairway" ? "gf-card-fairway" : "gf-card";
  return <div className={`${base} ${className}`} style={style}>{children}</div>;
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return <div className="gf-section-header">{children}</div>;
}

export function KPI({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const color =
    tone === "good"
      ? "var(--green)"
      : tone === "bad"
      ? "var(--red)"
      : tone === "warn"
      ? "var(--accent)"
      : "var(--ink)";
  return (
    <div className="gf-card flex flex-col gap-1">
      <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="gf-display text-4xl" style={{ color }}>
          {value}
        </span>
        {unit && (
          <span className="text-xs text-[var(--muted)] gf-mono">{unit}</span>
        )}
      </div>
      {hint && (
        <div className="text-[11px] text-[var(--muted)]">{hint}</div>
      )}
    </div>
  );
}

export function Pill({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "accent" | "red";
}) {
  const cls =
    variant === "accent" ? "gf-pill gf-pill-accent" : variant === "red" ? "gf-pill gf-pill-red" : "gf-pill";
  return <span className={cls}>{children}</span>;
}
