export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 top-0 min-h-screen w-screen">
      {children}
    </div>
  );
}
