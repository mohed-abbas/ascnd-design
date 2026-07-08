import Image from "next/image";
import {
  CAPTION_GAP,
  CARD_BORDER,
  CARD_HEIGHT,
  CARD_RADIUS,
  CARD_WIDTH,
  type Project,
} from "./showcase-spec";

/**
 * A single showcase card — the visual unit only (Figma node 435:526 + caption
 * 435:527). Placement + arc tilt are the section's job (showcase-scene.tsx): this
 * renders a fixed CARD_WIDTH×CARD_HEIGHT box so that box's centre is the stable
 * pivot reference, with the title + tag pills hanging BELOW as an absolute child
 * so they tilt with the card without changing the box height.
 *
 * The card's IMAGE chrome (white-hairline glass frame + rounded image + faint
 * top→bottom dark scrim, the Figma vignette) lives in its own inner div. When
 * `imageHidden` is set, that chrome is omitted while the layout box + caption
 * stay — this is how the WebGL wheel (showcase-canvas.tsx) takes over the card
 * IMAGES on capable devices while the DOM keeps the titles exactly in place. The
 * DOM chrome remains the SSR / no-JS / reduced-motion / mobile fallback.
 *
 * The tag pills reuse the site "menu" glass signature (white/40 edge, faint dark
 * fill, 2px backdrop-blur) — safe here because the card is a content sibling
 * ABOVE the fixed sky/cloud layers, never an ancestor of them.
 */
export default function ShowcaseCard({
  project,
  priority = false,
  imageHidden = false,
}: {
  project: Project;
  priority?: boolean;
  /** Omit the DOM image chrome (the WebGL wheel draws it instead). */
  imageHidden?: boolean;
}) {
  return (
    <div className="relative" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
      {/* Image chrome: white border + rounded image + scrim, clipped to the
          frame radius. Dropped when the WebGL wheel owns the card image. */}
      {!imageHidden && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            borderRadius: CARD_RADIUS,
            border: `${CARD_BORDER}px solid #ffffff`,
          }}
        >
          <Image
            src={project.src}
            alt={project.title}
            fill
            sizes={`${CARD_WIDTH}px`}
            priority={priority}
            className="object-cover"
          />
          {/* Faint dark scrim over the image (Figma: rgba(0,0,0,.1)→.05). */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/5" />
        </div>
      )}

      {/* Caption — hangs below the card, tilts with its arc angle. */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-4"
        style={{ top: `calc(100% + ${CAPTION_GAP}px)`, width: 141 }}
      >
        <p className="text-center text-[25px] leading-[1.1] text-white">
          {project.title}
        </p>
        <div className="flex items-center gap-1">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-[20px] border-[1.5px] border-white bg-gradient-to-b from-black/10 to-black/5 px-[15px] py-[5px] text-center text-[12px] leading-[1.1] whitespace-nowrap text-white backdrop-blur-[2px]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
