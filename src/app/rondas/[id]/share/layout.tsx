/**
 * Layout sin chrome de app — el snapshot se descarga como PNG limpio.
 */

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 top-0 min-h-screen w-screen">
      {children}
    </div>
  );
}
