export function HeroMesh() {
  return (
    <svg
      className="hero-mesh"
      viewBox="0 0 1080 510"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <filter id="mesh-blur" x="-30%" y="-40%" width="160%" height="180%">
          <feGaussianBlur stdDeviation="48" />
        </filter>
        <radialGradient id="mesh-blue">
          <stop offset="0" stopColor="#007cf0" stopOpacity=".94" />
          <stop offset="1" stopColor="#007cf0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mesh-cyan">
          <stop offset="0" stopColor="#00dfd8" stopOpacity=".9" />
          <stop offset="1" stopColor="#00dfd8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mesh-violet">
          <stop offset="0" stopColor="#7928ca" stopOpacity=".92" />
          <stop offset="1" stopColor="#7928ca" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mesh-pink">
          <stop offset="0" stopColor="#ff0080" stopOpacity=".88" />
          <stop offset="1" stopColor="#ff0080" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mesh-coral">
          <stop offset="0" stopColor="#ff4d4d" stopOpacity=".85" />
          <stop offset="1" stopColor="#ff4d4d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mesh-amber">
          <stop offset="0" stopColor="#f9cb28" stopOpacity=".88" />
          <stop offset="1" stopColor="#f9cb28" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mesh-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".55" stopColor="#fff" stopOpacity=".38" />
          <stop offset="1" stopColor="#fff" stopOpacity=".95" />
        </linearGradient>
        <pattern id="mesh-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#171717" strokeOpacity=".06" />
        </pattern>
      </defs>
      <g filter="url(#mesh-blur)">
        <ellipse cx="180" cy="285" rx="230" ry="190" fill="url(#mesh-blue)" />
        <ellipse cx="400" cy="205" rx="230" ry="190" fill="url(#mesh-cyan)" />
        <ellipse cx="620" cy="275" rx="245" ry="200" fill="url(#mesh-violet)" />
        <ellipse cx="820" cy="205" rx="215" ry="180" fill="url(#mesh-pink)" />
        <ellipse cx="735" cy="385" rx="205" ry="155" fill="url(#mesh-coral)" />
        <ellipse cx="950" cy="350" rx="185" ry="160" fill="url(#mesh-amber)" />
      </g>
      <rect width="1080" height="510" fill="url(#mesh-fade)" />
      <rect width="1080" height="510" fill="url(#mesh-grid)" />
    </svg>
  );
}
