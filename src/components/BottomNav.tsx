"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Inicio", icon: "⛳" },
  { href: "/range", label: "Range", icon: "🎯" },
  { href: "/rondas", label: "Cancha", icon: "🏌️" },
  { href: "/stats", label: "Stats", icon: "📊" },
  { href: "/jugadores", label: "Setup", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[var(--border)]">
      <div className="mx-auto max-w-md grid grid-cols-5">
        {tabs.map((t) => {
          const active =
            t.href === "/"
              ? pathname === "/"
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="flex flex-col items-center justify-center py-2 gap-0.5"
              style={{ color: active ? "var(--fairway)" : "var(--muted)" }}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ fontWeight: active ? 700 : 500 }}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
