/**
 * Layout sin chrome de app — la card debe verse full-width (820px) para
 * que matche con el formato del PDF oficial. Usado en preview y futuras
 * páginas de share público.
 */

export default function CardPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 top-0 min-h-screen w-screen">
      {children}
    </div>
  );
}
