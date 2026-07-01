import Image from "next/image";
import { SHOT_TILES } from "./cards-data";

// Shots dissolve just before the "receive" title so the label reads over clean
// glass. The clipping window is also the future scroll viewport for the grid.
const FADE = "linear-gradient(to bottom, black 78%, transparent 96%)";

/**
 * Card1 "receive" media (Figma 220:212): a collage of design-shot thumbnails.
 * The tiles live on a 594×510 plane that is larger than, and offset within, the
 * clipping window — so only the design's crop shows (top tiles cut at the top,
 * right tiles cut at the right). That offset is the infinite-scroll target for
 * later; static here. Tiles are flattened exports of the Figma dribbble shots.
 */
export default function ReceiveMedia() {
  return (
    <div
      className="absolute left-[31px] top-[30px] h-[300px] w-[378px] overflow-hidden"
      style={{ WebkitMaskImage: FADE, maskImage: FADE }}
    >
      <div className="absolute left-[-75px] top-[-88px] h-[510px] w-[594px]">
        {SHOT_TILES.map((t) => (
          <div
            key={t.src}
            className="absolute overflow-hidden rounded-[12px]"
            style={{ left: t.x, top: t.y, width: t.w, height: t.h }}
          >
            <Image src={t.src} alt={t.alt} fill sizes="300px" className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
