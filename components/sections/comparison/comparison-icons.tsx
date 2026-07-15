/**
 * Two-tone matrix glyphs — Figma nodes 469:585 (check) / 469:632 (dash).
 *
 * Both are drawn as TWO overlaid strokes: one full-white leg and one at 40%
 * opacity, giving the tick/minus its subtle diagonal light. Paths are lifted
 * verbatim from the Figma export (the `<g id="Frame">` group), so these are the
 * real assets, not hand-approximations. Kept inline (vs. /public SVGs) so they
 * inherit the flow, need no extra requests, and stay trivially styleable.
 */

/** Feature covered — the two-tone tick (30×30 in the design). */
export function CheckMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 30"
      fill="none"
      className={className}
      role="img"
      aria-label="included"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.6608 21.8815L13.6551 20.8871L11.6664 18.8984L7.55687 14.7889C7.0077 14.2396 6.1173 14.2396 5.56813 14.7889C5.01895 15.338 5.01896 16.2284 5.56814 16.7776L10.6721 21.8815C11.2212 22.4308 12.1116 22.4308 12.6608 21.8815Z"
        fill="white"
      />
      <path
        opacity="0.4"
        d="M24.4295 10.1096C24.9787 9.56043 24.9787 8.67004 24.4295 8.12087C23.8803 7.57169 22.9899 7.57169 22.4408 8.12087L11.6641 18.8976L13.6528 20.8862L24.4295 10.1096Z"
        fill="white"
      />
    </svg>
  );
}

/** Not covered — the two-tone minus (24×24 in the design). */
export function Dash({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label="not included"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 10.875C5.37868 10.875 4.875 11.3787 4.875 12C4.875 12.6213 5.37868 13.125 6 13.125H12.0003V10.875H6Z"
        fill="white"
      />
      <path
        opacity="0.4"
        d="M19.1253 12C19.1253 11.3787 18.6217 10.875 18.0003 10.875H12V13.125H18.0003C18.6217 13.125 19.1253 12.6213 19.1253 12Z"
        fill="white"
      />
    </svg>
  );
}
