import React from 'react';

export function CardBack({ label, variant = 'back-plain' }: { label?: string; variant?: string }) {
  return (
    <div className={`card-back back-${variant}`} data-back={variant} aria-hidden={!label} aria-label={label}>
      <svg viewBox="0 0 80 114" className="card-back-svg">
        <defs>
          <radialGradient id={`cb-glow-${variant}`} cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={variant === 'back-tide' ? '#1a3a48' : '#3a1a28'} />
            <stop offset="100%" stopColor={variant === 'back-tide' ? '#0c1820' : '#140c10'} />
          </radialGradient>
        </defs>
        <rect x="1" y="1" width="78" height="112" rx="6" fill={`url(#cb-glow-${variant})`} stroke={variant === 'back-tide' ? '#3a6a78' : '#6a3a28'} strokeWidth="2" />
        <rect x="7" y="8" width="66" height="98" rx="3" fill="none" stroke={variant === 'back-tide' ? '#5a98a8' : '#8a5040'} strokeWidth="1" />
        <path
          d="M40 22 L46 38 L63 40 L50 52 L54 69 L40 60 L26 69 L30 52 L17 40 L34 38 Z"
          fill={variant === 'back-tide' ? '#204060' : '#6a2030'}
          stroke={variant === 'back-tide' ? '#48a8c4' : '#c45a48'}
          strokeWidth="1.2"
        />
        <circle cx="40" cy="46" r="7" fill="#1a2848" stroke="#3a78c8" strokeWidth="1.4" />
      </svg>
    </div>
  );
}
