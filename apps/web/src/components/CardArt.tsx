import React, { useId } from 'react';
import { templateById, type Silhouette } from '@sigilgrid/content';

const portraits = {
  ...import.meta.glob('../assets/cards/card-*.webp', { eager: true, import: 'default' }),
  ...import.meta.glob('../assets/cards/card-*.png', { eager: true, import: 'default' }),
} as Record<string, string>;

function portraitSrc(cardNumber: number): string | undefined {
  const n = String(cardNumber).padStart(3, '0');
  return portraits[`../assets/cards/card-${n}.png`] ?? portraits[`../assets/cards/card-${n}.webp`];
}

export const CARD_ART_COUNT = new Set(
  Object.keys(portraits)
    .map((key) => key.match(/card-(\d{3})\./)?.[1])
    .filter(Boolean),
).size;

export function CardArt({ templateId }: { templateId: string }) {
  let cardNumber: number | undefined;
  let sil: Silhouette = 'relic';
  try {
    const t = templateById(templateId);
    cardNumber = t.cardNumber;
    sil = t.silhouette;
  } catch {
    /* keep defaults */
  }
  const src = cardNumber ? portraitSrc(cardNumber) : undefined;
  if (src) {
    return <img src={src} alt="" className="card-art-img" draggable={false} />;
  }
  return <ParametricArt templateId={templateId} silhouette={sil} />;
}

function ParametricArt({ templateId, silhouette }: { templateId: string; silhouette: Silhouette }) {
  const uid = useId().replace(/:/g, '');
  const hue = hashHue(templateId);
  const ink = '#2a1c0c';
  const fill = `hsl(${hue} 42% 58%)`;
  const fill2 = `hsl(${(hue + 28) % 360} 38% 42%)`;
  const glow = `hsl(${hue} 50% 78%)`;
  return (
    <svg viewBox="0 0 80 88" className="card-art-svg" aria-hidden>
      <defs>
        <radialGradient id={`sky-${uid}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f7ead0" />
          <stop offset="100%" stopColor="#c9b189" />
        </radialGradient>
      </defs>
      <rect width="80" height="88" rx="4" fill={`url(#sky-${uid})`} />
      <ellipse cx="40" cy="78" rx="28" ry="8" fill={fill2} opacity="0.35" />
      {draw(silhouette, ink, fill, fill2, glow)}
    </svg>
  );
}

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function draw(sil: Silhouette, ink: string, fill: string, fill2: string, glow: string) {
  switch (sil) {
    case 'humanoid':
      return (
        <g>
          <circle cx="40" cy="32" r="10" fill={glow} stroke={ink} />
          <path d="M28 72 L32 44 H48 L52 72 Z" fill={fill} stroke={ink} />
          <path d="M24 50 H56" stroke={ink} />
        </g>
      );
    case 'beast':
      return (
        <g>
          <ellipse cx="42" cy="54" rx="18" ry="12" fill={fill} stroke={ink} />
          <circle cx="28" cy="44" r="9" fill={fill2} stroke={ink} />
          <path d="M22 38 L16 26 L28 40 M34 36 L32 22 L38 38" fill={fill2} stroke={ink} />
          <circle cx="25" cy="42" r="1.4" fill={ink} />
        </g>
      );
    default:
      return (
        <g>
          <rect x="22" y="24" width="36" height="44" rx="4" fill={fill2} stroke={ink} />
          <path d="M40 32 L52 44 L40 60 L28 44 Z" fill={glow} stroke={ink} />
        </g>
      );
  }
}
