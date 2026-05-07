// Marca visual del score vs par estilo Garmin/TV.
//   Eagle (-2 o mejor): doble círculo verde
//   Birdie (-1):       círculo verde
//   Par (0):           sin marca
//   Bogey (+1):        cuadrado naranja
//   Doble+ (+2 o peor): doble cuadrado rojo
export default function ScoreMark({
  score,
  par,
  size = 24,
}: {
  score: number | null | undefined;
  par: number;
  size?: number;
}) {
  if (score == null || score === 0) {
    return <span className="text-[var(--muted)] gf-mono">—</span>;
  }
  const vsPar = score - par;
  const num = <span className="gf-mono font-semibold">{score}</span>;
  const wrapper = (children: React.ReactNode) => (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );

  if (vsPar <= -2) {
    return wrapper(
      <>
        <span
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: "var(--green)" }}
        />
        <span
          className="absolute rounded-full border-2"
          style={{ borderColor: "var(--green)", inset: 3 }}
        />
        <span className="relative" style={{ color: "var(--green)" }}>
          {num}
        </span>
      </>,
    );
  }
  if (vsPar === -1) {
    return wrapper(
      <>
        <span
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: "var(--green)" }}
        />
        <span className="relative" style={{ color: "var(--green)" }}>
          {num}
        </span>
      </>,
    );
  }
  if (vsPar === 0) {
    return <span className="gf-mono">{score}</span>;
  }
  if (vsPar === 1) {
    return wrapper(
      <>
        <span
          className="absolute inset-0 border-2"
          style={{ borderColor: "var(--accent)" }}
        />
        <span className="relative" style={{ color: "var(--accent)" }}>
          {num}
        </span>
      </>,
    );
  }
  // +2 o peor
  return wrapper(
    <>
      <span
        className="absolute inset-0 border-2"
        style={{ borderColor: "var(--red)" }}
      />
      <span
        className="absolute border-2"
        style={{ borderColor: "var(--red)", inset: 3 }}
      />
      <span className="relative font-bold" style={{ color: "var(--red)" }}>
        {num}
      </span>
    </>,
  );
}
