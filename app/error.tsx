"use client";

import { useEffect } from "react";
import Button from "@/components/ui/button";
import Wordmark from "@/components/ui/wordmark";

/**
 * Runtime-error boundary for every route. Error boundaries MUST be Client
 * Components (Next error.js docs) — this is the only reason for "use client".
 *
 * Like not-found.tsx it renders inside the root layout, so the sky and clouds
 * are already behind it; it draws only the centred column.
 *
 * `unstable_retry` is Next 16's retry handle (it replaced `reset`): it re-fetches
 * and re-renders the failed segment in place. That's the right first move here —
 * this site's realistic failure mode is a WebGL context or a chunk that lost a
 * race, and a re-render usually clears it without a full reload.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // No error-reporting service is wired up yet — the console is the only sink.
    // Point a real reporter here (Sentry, Vercel observability) when there is one.
    console.error(error);
  }, [error]);

  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center text-white">
      <Wordmark className="text-[28px]" />

      <h1 className="mt-14 max-w-[18ch] font-product text-[clamp(2rem,6vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
        something went wrong
      </h1>

      <p className="mt-5 max-w-[46ch] font-product text-[clamp(1rem,2.2vw,1.125rem)] leading-relaxed text-white/75">
        That&rsquo;s on us, not you. Try again — and if it keeps happening,
        we&rsquo;d genuinely like to hear about it.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={unstable_retry}>try again</Button>
        <Button variant="clear" href="/">
          back to the homepage
        </Button>
      </div>

      {/* The digest is the ONLY handle on a production error (stack traces are
          stripped server-side), so surface it — it's what makes a bug report
          actionable. Absent in dev, hence the guard. */}
      {error.digest && (
        <p className="mt-8 font-mono text-[12px] tracking-[0.08em] text-white/45">
          error {error.digest}
        </p>
      )}
    </main>
  );
}
