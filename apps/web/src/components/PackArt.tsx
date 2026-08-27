import React from 'react';

/**
 * Procedural pack art, one colourway per tier. Drawn rather than imported so
 * the three packs stay visually related and cost nothing to ship; swapping in
 * real artwork later means replacing the <svg> body per tier.
 */
const SKINS: Record<
  string,
  { ink: string; mid: string; edge: string; foil: string; crest: string; label: string }
> = {
  ashfall: {
    ink: '#2b2118',
    mid: '#4a3a28',
    edge: '#7d6647',
    foil: '#c9b184',
    crest: '#e3d3ae',
    label: 'ASHFALL',
  },
  ember: {
    ink: '#3a1410',
    mid: '#732a1c',
    edge: '#b7502a',
    foil: '#f0a259',
    crest: '#ffd9a8',
    label: 'EMBER',
  },
  lantern: {
    ink: '#0f1526',
    mid: '#1d2b4d',
    edge: '#3c5a94',
    foil: '#8fd0e8',
    crest: '#dff3ff',
    label: 'LANTERN',
  },
};

export function PackArt({
  tierId,
  torn = false,
  className,
}: {
  tierId: string;
  torn?: boolean;
  className?: string;
}) {
  const s = SKINS[tierId] ?? SKINS.ashfall!;
  const uid = `pack-${tierId}`;

  return (
    <svg
      viewBox="0 0 120 170"
      className={`pack-art ${className ?? ''}`}
      role="img"
      aria-label={`${s.label} booster pack`}
      data-testid={`pack-art-${tierId}`}
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={s.mid} />
          <stop offset="45%" stopColor={s.ink} />
          <stop offset="100%" stopColor={s.mid} />
        </linearGradient>
        <linearGradient id={`${uid}-foil`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stopColor={s.foil} stopOpacity="0" />
          <stop offset="42%" stopColor={s.foil} stopOpacity="0.75" />
          <stop offset="58%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="72%" stopColor={s.foil} stopOpacity="0.7" />
          <stop offset="100%" stopColor={s.foil} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor={s.crest} stopOpacity="0.4" />
          <stop offset="100%" stopColor={s.crest} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x="6" y="6" width="108" height="158" rx="6" />
        </clipPath>
      </defs>

      {/* Body */}
      <rect x="6" y="6" width="108" height="158" rx="6" fill={`url(#${uid}-body)`} stroke={s.edge} strokeWidth="1.5" />
      <g clipPath={`url(#${uid}-clip)`}>
        <rect x="6" y="6" width="108" height="158" fill={`url(#${uid}-glow)`} />
        <rect x="6" y="6" width="108" height="158" fill={`url(#${uid}-foil)`} className="pack-sheen" />
        {/* Weave texture */}
        {Array.from({ length: 16 }, (_, i) => (
          <line key={i} x1="6" y1={10 + i * 10} x2="114" y2={4 + i * 10} stroke={s.edge} strokeOpacity="0.14" strokeWidth="1" />
        ))}
      </g>

      {/* Crest */}
      <g transform="translate(60 66)">
        <circle r="25" fill="none" stroke={s.foil} strokeOpacity="0.55" strokeWidth="1.2" />
        <circle r="18" fill="none" stroke={s.foil} strokeOpacity="0.35" strokeWidth="0.8" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <polygon
              key={i}
              points="0,-24 3,-16 -3,-16"
              fill={s.crest}
              fillOpacity={i % 2 === 0 ? 0.95 : 0.45}
              transform={`rotate(${(a * 180) / Math.PI})`}
            />
          );
        })}
        <path d="M0,-9 L8,0 L0,9 L-8,0 Z" fill={s.crest} fillOpacity="0.9" />
      </g>

      {/* Tear strip — lifts away when opened */}
      <g className={`pack-strip ${torn ? 'torn' : ''}`}>
        <path d="M6 30 H114 V22 Q90 26 60 21 Q30 16 6 22 Z" fill={s.edge} fillOpacity="0.9" />
        <path
          d="M6 30 H114 V33 Q90 29 60 34 Q30 39 6 33 Z"
          fill={s.ink}
          stroke={s.foil}
          strokeOpacity="0.4"
          strokeWidth="0.6"
        />
      </g>

      <text
        x="60"
        y="128"
        textAnchor="middle"
        fontSize="11"
        letterSpacing="3"
        fill={s.crest}
        fillOpacity="0.92"
        fontFamily="'Iowan Old Style', Georgia, serif"
      >
        {s.label}
      </text>
      <text x="60" y="143" textAnchor="middle" fontSize="6.5" letterSpacing="2.4" fill={s.foil} fillOpacity="0.7">
        SEALED SIGILS
      </text>
    </svg>
  );
}
