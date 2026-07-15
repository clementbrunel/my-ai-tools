interface MiniF1CarProps {
  /** Constructor hex color that tints the bodywork. */
  color: string;
  /** Rendered height in px (the car is drawn nose-up, ratio 1:2). */
  size?: number;
  className?: string;
}

/**
 * Top-view single-seater silhouette, tinted with the constructor color.
 * One parametric SVG for the whole grid — no image assets.
 */
const MiniF1Car: React.FC<MiniF1CarProps> = ({ color, size = 48, className }) => (
  <svg
    viewBox="0 0 60 120"
    width={size / 2}
    height={size}
    className={className}
    aria-hidden="true"
  >
    {/* Front wing */}
    <rect x="6" y="2" width="48" height="7" rx="3" fill={color} />
    {/* Nose */}
    <path d="M30 4 L37 34 L23 34 Z" fill={color} />
    {/* Front wheels */}
    <rect x="2" y="20" width="12" height="20" rx="4" fill="#1a1a1a" />
    <rect x="46" y="20" width="12" height="20" rx="4" fill="#1a1a1a" />
    {/* Front axle fairing */}
    <rect x="14" y="27" width="32" height="6" fill={color} opacity="0.85" />
    {/* Monocoque + sidepods */}
    <path d="M23 34 L37 34 L42 62 L42 88 L18 88 L18 62 Z" fill={color} />
    {/* Cockpit */}
    <ellipse cx="30" cy="56" rx="7" ry="12" fill="#111827" />
    {/* Halo hint */}
    <path d="M23 50 Q30 42 37 50" stroke="#111827" strokeWidth="3" fill="none" />
    {/* Engine cover shading */}
    <rect x="26" y="70" width="8" height="18" rx="3" fill="#000000" opacity="0.25" />
    {/* Rear wheels */}
    <rect x="1" y="82" width="14" height="24" rx="4" fill="#1a1a1a" />
    <rect x="45" y="82" width="14" height="24" rx="4" fill="#1a1a1a" />
    {/* Rear axle fairing */}
    <rect x="15" y="90" width="30" height="7" fill={color} opacity="0.85" />
    {/* Rear wing */}
    <rect x="8" y="108" width="44" height="9" rx="3" fill={color} />
    <rect x="8" y="112" width="44" height="2" fill="#000000" opacity="0.3" />
  </svg>
);

export default MiniF1Car;
