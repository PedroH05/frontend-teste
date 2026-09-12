// Navio de contêineres (SVG) — portado literalmente de SHIP_SVG/SHIP_SVG_NOWAVE
// em captacao-valetrade/public/index.html (usado no estado vazio das telas e
// na decoração do card de login).

export function ShipScene({ waves = true }: { waves?: boolean }) {
  return (
    <svg className="vt-ship-scene" viewBox="0 0 160 112" aria-hidden="true" width="100%" height="auto">
      <g className="vt-ship">
        <rect x="52" y="28" width="20" height="13" rx="2" fill="#C0392B" />
        <rect x="74" y="28" width="20" height="13" rx="2" fill="#C9A227" />
        <rect x="41" y="42" width="20" height="13" rx="2" fill="#2C7A5B" />
        <rect x="63" y="42" width="20" height="13" rx="2" fill="#3C5A80" />
        <rect x="85" y="42" width="20" height="13" rx="2" fill="#C0392B" />
        <rect x="108" y="33" width="14" height="22" rx="2" fill="#5a544c" />
        {waves && <rect x="111" y="37" width="8" height="5" rx="1" fill="#cdd6e0" />}
        <path d="M30 56 H128 L118 74 Q113 79 104 79 H50 Q41 79 36 74 Z" fill="#1c1a16" />
        <rect x="36" y="59" width="88" height="4" rx="1" fill="#C01829" />
      </g>
      {waves && (
        <>
          <path
            className="vt-wave"
            d="M-100 86 q20 -7 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V112 H-100 Z"
            fill="#3C5A80"
            opacity=".3"
          />
          <path
            className="vt-wave"
            style={{ animationDuration: '4.6s' }}
            d="M-100 92 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V112 H-100 Z"
            fill="#3C5A80"
            opacity=".2"
          />
        </>
      )}
    </svg>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="p-[46px_20px] text-center" style={{ color: 'var(--vt-muted)' }}>
      <div className="mx-auto mb-1.5 max-w-[180px]">
        <ShipScene />
      </div>
      <div className="mb-1 text-[14px] font-bold" style={{ color: 'var(--vt-ink)' }}>{title}</div>
      <div className="text-[12.5px] leading-relaxed">{subtitle}</div>
    </div>
  );
}
