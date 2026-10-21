/** Hero illustration: a perfume bottle with three slowly shifting liquid layers. */
export function DecorativeBottle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 320" className={className} aria-hidden>
      <defs>
        <linearGradient id="hero-glass" x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.1" />
        </linearGradient>
        <clipPath id="hero-body">
          <rect x="30" y="110" width="140" height="190" rx="18" />
        </clipPath>
      </defs>
      <rect x="78" y="40" width="44" height="34" rx="4" fill="#c9a84c" />
      <rect x="86" y="74" width="28" height="38" fill="#2a2a2a" stroke="#5a4a2a" />
      <g clipPath="url(#hero-body)">
        <rect x="30" y="236" width="140" height="70" fill="#6b3a2a">
          <animate attributeName="y" values="236;232;236" dur="7s" repeatCount="indefinite" />
        </rect>
        <rect x="30" y="182" width="140" height="56" fill="#9b4f86" opacity="0.9">
          <animate attributeName="y" values="182;178;182" dur="6s" repeatCount="indefinite" />
        </rect>
        <rect x="30" y="140" width="140" height="44" fill="#c9a84c" opacity="0.85">
          <animate attributeName="y" values="140;136;140" dur="5s" repeatCount="indefinite" />
        </rect>
      </g>
      <rect x="30" y="110" width="140" height="190" rx="18" fill="url(#hero-glass)" stroke="#3a3a3a" strokeWidth="2" />
      <rect x="44" y="124" width="8" height="150" rx="4" fill="#ffffff" opacity="0.08" />
    </svg>
  );
}
