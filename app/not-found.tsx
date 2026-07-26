import type { Metadata } from "next";
import Button from "@/components/ui/button";
import Wordmark from "@/components/ui/wordmark";

/**
 * 404. Rendered INSIDE the root layout, so the fixed sky, clouds, cursor and
 * mode switcher are already behind it — this file only draws the centred column
 * and stays transparent, exactly like every real section.
 *
 * No navbar: a dead-end page shouldn't offer the full menu, and the wordmark is
 * already the way home (it's the same mark the hero docks). The one CTA is the
 * solid variant, matching the hero's primary action.
 *
 * A `not-found` is a real 404 status, so it must not be indexed — Next omits the
 * root layout's index directive here anyway, but stating it is cheap insurance
 * against a crawler treating it as a soft 404.
 */
export const metadata: Metadata = {
  title: "page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center text-white">
      <Wordmark className="text-[28px]" />

      <p className="mt-14 font-mono text-[14px] uppercase tracking-[0.2em] text-white/70">
        404
      </p>

      <h1 className="mt-4 max-w-[16ch] font-product text-[clamp(2rem,6vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
        this page drifted off
      </h1>

      <p className="mt-5 max-w-[46ch] font-product text-[clamp(1rem,2.2vw,1.125rem)] leading-relaxed text-white/75">
        The link you followed doesn&rsquo;t point anywhere on the site. Nothing
        broke — the address just isn&rsquo;t one of ours.
      </p>

      <div className="mt-10">
        <Button href="/">back to the homepage</Button>
      </div>
    </main>
  );
}
