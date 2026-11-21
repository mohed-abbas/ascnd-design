import type { Metadata } from "next";
import Footer from "@/components/sections/footer/footer";
import RocksPlayground from "./rocks-playground";
import "./rocksplay.css";

export const metadata: Metadata = {
  title: "rocks playground",
};

/**
 * /lab/rocksplay — the per-mode rock grade playground (branch lab/rocks-night).
 *
 * Renders the REAL <Footer/> over the real sky (the root layout's Background,
 * clouds, ThemeDriver and ModeSwitcher all apply), so what you tune here is
 * what the footer will look like. The grade is applied from outside footer.tsx
 * (rocksplay.css + the panel in rocks-playground.tsx) — nothing in the section
 * itself changes.
 *
 * The 10-viewport sky spacer is load-bearing. An unmapped route gets the HOME
 * cloud scene (cloud-specs.ts cloudSceneForPath), whose field clouds are
 * page-anchored at 0–7 viewports down (on screen up to +1.5vh past the last) —
 * including the hero's rock-base band, which paints on the FRONT plane over the
 * wordmark. On "/" the footer sits ~14 viewports down, clear of all of them; the
 * spacer puts it past them here too, so the rocks are judged in the same open
 * sky. The panel jumps to the bottom on load, and the footer's one-shot wordmark
 * reveal (footer-reveal.tsx, "top 72%") plays as it does on the homepage.
 */
export default function RocksPlayPage() {
  return (
    <main className="flex w-full flex-col">
      <RocksPlayground>
        <section className="flex min-h-[1000vh] w-full items-end justify-center pb-10">
          <p className="text-[14px] text-white/80">
            footer rock grade playground · switch modes with the rail (right) or
            the panel
          </p>
        </section>
        <Footer />
      </RocksPlayground>
    </main>
  );
}
