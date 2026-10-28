/**
 * The Health mark: a flame square with an ink pulse line.
 *
 * Inline SVG so it needs no network request and stays sharp at any size.
 * The same geometry lives in app/icon.svg and public/health-mark.svg, and
 * scripts/make-icons.mjs rasterises it for the installable app icons.
 *
 *   <HealthMark size={24} />
 */
export default function HealthMark({ size = 24, className = "", title = "Health", ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 22 22"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      {...props}
    >
      <rect width="22" height="22" fill="#EB6E3A" />
      <path d="M4 13h4l2-6 3 10 2-4h3" fill="none" stroke="#142B38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
