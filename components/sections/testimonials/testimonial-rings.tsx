/**
 * The thin white "orbit" outlines + accent dots that ring each floating rock
 * (Figma node 482:460 `RocksEllipsesOulines`). Authored as a clean inline SVG
 * — Figma's own export shipped the whole canvas frame (a #1E1E1E backing rect,
 * the page background, etc.), none of which belongs here.
 *
 * Coordinates are in the group's own space (viewBox 1192×545, matching the
 * `RocksEllipsesOulines` frame), so this sits at left-[20.28px] top-[17px]
 * inside the rocks block and its circles land concentric with each rock. Every
 * ring/dot carries a data hook so the reveal can stagger them per rock.
 */
export default function TestimonialRings({
  className,
  ...rest
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 1192 545"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {/* Rings — one per rock, concentric with it (5282 · 5284 · 5286 · 5288) */}
      <circle data-ring="0" cx="132.719" cy="84" r="73.5" stroke="white" />
      <circle data-ring="1" cx="1113.52" cy="470.555" r="73.5" stroke="white" />
      <circle
        data-ring="2"
        cx="1159.44"
        cy="37.7432"
        r="31.9429"
        stroke="white"
        strokeWidth="0.434597"
      />
      <circle
        data-ring="3"
        cx="41.9182"
        cy="470.926"
        r="41.6349"
        stroke="white"
        strokeWidth="0.566462"
      />

      {/* Accent dots riding each ring (5283 · 5285 · 5287 · 5289) */}
      <circle data-dot="0" cx="181.719" cy="6" r="6" fill="white" />
      <circle data-dot="1" cx="1042.52" cy="402.555" r="6" fill="white" />
      <circle data-dot="2" cx="1128.58" cy="8.19059" r="2.60758" fill="white" />
      <circle data-dot="3" cx="55.6996" cy="432.407" r="3.39877" fill="white" />
    </svg>
  );
}
