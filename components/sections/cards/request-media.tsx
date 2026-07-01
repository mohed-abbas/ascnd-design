import { REQUEST_PLACEHOLDER, REQUEST_TAGS } from "./cards-data";

// The stack ends just above the "request" title; a bottom fade mask dissolves
// the last row (matching the design's alpha mask). This fade is also the
// viewport the rows will scroll through when the infinite conveyor is wired up.
const FADE = "linear-gradient(to bottom, black 75%, transparent 100%)";

/**
 * One request-input row (Figma 140:13801 …): a pill-shaped "request anything…"
 * field with a right-aligned category tag. Fill white/10 + a 1px white/50
 * border (measured ~0.5 against the rendered node — get_design_context flattens
 * the stroke to opaque `border-white`; matches the card family's glass edges).
 */
function RequestRow({ tag }: { tag: string }) {
  return (
    <div className="relative h-[44.67px] w-full shrink-0 overflow-clip rounded-[37px] border border-solid border-white/50 bg-white/10">
      <span className="absolute left-[26px] top-1/2 -translate-y-1/2 whitespace-nowrap font-product text-[16px] leading-none text-white">
        {REQUEST_PLACEHOLDER}
      </span>
      <span className="absolute right-[11px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[31px] bg-white px-[9.578px] py-[4.789px] text-[10px] leading-[1.5] text-[#263138]">
        {tag}
      </span>
    </div>
  );
}

/**
 * Card2 "request" media (Figma 140:13791): a stacked column of request-input
 * pills that fades out toward the title. Data-driven so the column can loop as
 * an infinite conveyor later.
 */
export default function RequestMedia() {
  return (
    <div
      className="absolute left-[31px] top-[23px] flex w-[378px] flex-col gap-[12px]"
      style={{ WebkitMaskImage: FADE, maskImage: FADE }}
    >
      {REQUEST_TAGS.map((tag, i) => (
        <RequestRow key={i} tag={tag} />
      ))}
    </div>
  );
}
