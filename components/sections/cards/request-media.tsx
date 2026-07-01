import Image from "next/image";
import { REQUEST_ITEMS, TOOL_ICONS, type RequestItem } from "./cards-data";

// The stack of rows overflows the card behind the title; a bottom fade mask
// dissolves the lower rows before they reach the "request" label — matching the
// design's alpha mask. This fade is also the viewport the rows will scroll
// through when the infinite conveyor is wired up.
const FADE = "linear-gradient(to bottom, black 55%, transparent 82%)";

// bg-white/10 fill + a 1px white/50 border (measured ~0.5 against the rendered
// node — get_design_context flattens the stroke to opaque `border-white`).
/** One request card (Figma 220:176 / 220:188 / 220:200). */
function RequestRow({ tall, body }: RequestItem) {
  return (
    <div
      className={`relative w-full shrink-0 overflow-clip rounded-[20px] border border-solid border-white/50 bg-white/10 ${
        tall ? "h-[205px]" : "h-[103px]"
      }`}
    >
      <div className="absolute left-[18px] top-[11px] flex w-[344px] items-center justify-between">
        <span className="whitespace-nowrap font-product text-[20px] leading-none text-white">
          New Landing Page
        </span>
        <span className="rounded-[31px] bg-white px-[9.578px] py-[4.789px] text-[10px] leading-[1.5] text-[#263138]">
          UI/UX
        </span>
      </div>

      <p className="absolute left-[17px] top-[51px] w-[310px] font-light text-[14px] leading-[1.1] text-white">
        {body}
      </p>

      {/* Tool row (attach / format / copy) — clipped away on the short rows. */}
      <div className="absolute left-[17px] top-[159px] flex gap-[5px]">
        {TOOL_ICONS.map((ic) => (
          <Image key={ic.src} src={ic.src} alt={ic.alt} width={24} height={24} unoptimized />
        ))}
      </div>
    </div>
  );
}

/**
 * Card2 "request" media (Figma 220:170): a stacked column of request cards that
 * fades out toward the title. Data-driven so the column can loop as an infinite
 * conveyor later.
 */
export default function RequestMedia() {
  return (
    <div
      className="absolute left-[31px] top-[29px] flex w-[378px] flex-col gap-[10px]"
      style={{ WebkitMaskImage: FADE, maskImage: FADE }}
    >
      {REQUEST_ITEMS.map((item, i) => (
        <RequestRow key={i} tall={item.tall} body={item.body} />
      ))}
    </div>
  );
}
