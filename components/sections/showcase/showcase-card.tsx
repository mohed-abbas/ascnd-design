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
 * 435:527). Placement + arc tilt are the section's job (showcase.tsx): this
 * renders a fixed CARD_WIDTH×CARD_HEIGHT box so that box's centre is the stable
 * pivot reference, with the title + tag pills hanging BELOW as an absolute child
 * so they tilt with the card without changing the box height.
 *
 * The card is a white-hairline glass frame over the sky: a rounded image with a
 * faint top→bottom dark scrim (the Figma vignette). The tag pills reuse the site
 * "menu" glass signature (white/40 edge, faint dark fill, 2px backdrop-blur) —
 * safe here because the card is a content sibling ABOVE the fixed sky/cloud
 * layers, never an ancestor of them.
 */
export default function ShowcaseCard({
  project,
  priority = false,
}: {
  project: Project;
  priority?: boolean;
}) {
  return (
    <div
      className="relative"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: CARD_RADIUS,
        border: `${CARD_BORDER}px solid #ffffff`,
      }}
    >
      {/* Rounded image fill. overflow-hidden clips it to the frame radius. */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ borderRadius: CARD_RADIUS }}
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
