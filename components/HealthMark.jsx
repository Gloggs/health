/**
 * The health mark (Guild UK product icon, 6 November 2026): the Guild UK octagon stamp frame with health's
 * own symbol, a pulse line, ending in a coral dot. Forest ground, white lines.
 *
 * Inline SVG so it needs no network request and stays sharp at any size.
 * The same geometry lives in app/icon.svg and public/health-mark.svg.
 *
 *   <HealthMark size={24} />
 */
export default function HealthMark({ size = 24, className = "", title = "Health", ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" width={size} height={size} role="img" aria-label={title} className={className} {...props}>
      <rect width="22" height="22" fill="#174131" />
      <path d="M6.5 2H15.5L20 6.5V15.5L15.5 20H6.5L2 15.5V6.5Z" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
      <path d="M5.5 11.5h2.5l1.5-3.5 2.5 6.5 1.5-3h2" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" />
      <rect x="16" y="10.5" width="2" height="2" fill="#F39380" />
    </svg>
  );
}
