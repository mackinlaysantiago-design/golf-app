"use client";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button onClick={logout} className="gf-btn gf-btn-secondary w-full mt-4 text-sm">
      🚪 Cerrar sesión
    </button>
  );
}
