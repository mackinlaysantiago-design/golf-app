"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const sp = useSearchParams();
  const from = sp.get("from") || "/";
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      window.location.href = from;
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Error");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="gf-card w-full max-w-sm space-y-3">
        <h1 className="gf-display text-3xl text-[var(--fairway)] text-center">
          Golf Performance
        </h1>
        <p className="text-xs text-[var(--muted)] text-center">
          Ingresá el password de la app
        </p>
        <input
          type="password"
          autoFocus
          className="gf-input"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        {err && <p className="text-xs text-[var(--red)] text-center">{err}</p>}
        <button type="submit" disabled={busy} className="gf-btn w-full">
          {busy ? "..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
