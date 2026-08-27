import React from 'react';

export function CardBack({ label }: { label?: string }) {
  return (
    <div className="card-back" aria-hidden={!label} aria-label={label}>
      <svg viewBox="0 0 80 114" className="card-back-svg">
        <defs>
          <radialGradient id="cb-glow" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#3a1a28" />
            <stop offset="100%" stopColor="#140c10" />
          </radialGradient>
        </defs>
        <rect x="1" y="1" width="78" height="112" rx="6" fill="url(#cb-glow)" stroke="#6a3a28" strokeWidth="2" />
        <rect x="7" y="8" width="66" height="98" rx="3" fill="none" stroke="#8a5040" strokeWidth="1" />
        <path
          d="M40 22 L46 38 L63 40 L50 52 L54 69 L40 60 L26 69 L30 52 L17 40 L34 38 Z"
          fill="#6a2030"
          stroke="#c45a48"
          strokeWidth="1.2"
        />
        <circle cx="40" cy="46" r="7" fill="#1a2848" stroke="#3a78c8" strokeWidth="1.4" />
      </svg>
    </div>
  );
}
