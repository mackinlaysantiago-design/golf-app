/**
 * Layout sin chrome de app — la card debe verse full-width (820px).
 */

export default function CardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 top-0 min-h-screen w-screen">
      {children}
    </div>
  );
}
