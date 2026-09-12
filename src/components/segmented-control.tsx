'use client';

import { useLayoutEffect, useRef } from 'react';

// Controle segmentado com pílula deslizante — portado de .seg/.seg-ind em
// captacao-valetrade/public/index.html. Usado nas abas de Captações e nos
// filtros de Histórico/Dashboard.

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const btnRefs = useRef(new Map<string, HTMLButtonElement>());
  const indRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const btn = btnRefs.current.get(value);
    const ind = indRef.current;
    if (!btn || !ind) return;
    ind.style.left = `${btn.offsetLeft}px`;
    ind.style.width = `${btn.offsetWidth}px`;
    ind.style.opacity = '1';
  }, [value, options]);

  return (
    <div className="vt-seg">
      <div ref={indRef} className="vt-seg-ind" />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          ref={(el) => {
            if (el) btnRefs.current.set(opt.value, el);
            else btnRefs.current.delete(opt.value);
          }}
          className={`vt-seg-btn${opt.value === value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
