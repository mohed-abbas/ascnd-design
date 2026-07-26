"use client";

/**
 * Last-resort boundary: catches errors thrown by the ROOT LAYOUT itself, which
 * app/error.tsx sits inside and therefore cannot catch (Next error.js docs).
 *
 * When this renders, the root layout is GONE — no fonts, no globals.css tokens,
 * no sky, no Tailwind classes worth trusting. So everything here is inline and
 * self-contained: the sky is a literal gradient, the type is a system stack.
 * Reaching for the design system in this file is how a fallback ends up broken
 * in exactly the situation it exists for.
 *
 * `metadata` exports aren't supported in a Client Component, so the tab title is
 * React's <title> element instead.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 24,
          textAlign: "center",
          color: "#ffffff",
          background:
            "linear-gradient(180deg, #4a9dff 0%, #62abff 55%, #9cc9ff 100%)",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <title>something went wrong — ascnd</title>

        <span style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.03em" }}>
          ascnd
        </span>

        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2rem, 6vw, 3.25rem)",
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            maxWidth: "18ch",
          }}
        >
          something went wrong
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth: "46ch",
            fontSize: "clamp(1rem, 2.2vw, 1.125rem)",
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          That&rsquo;s on us, not you. Try again — and if it keeps happening,
          we&rsquo;d genuinely like to hear about it.
        </p>

        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{
            marginTop: 8,
            padding: "9px 22px",
            fontSize: 16,
            fontFamily: "inherit",
            color: "#263138",
            background: "linear-gradient(180deg, #ffffff 0%, #efefef 100%)",
            border: "none",
            borderRadius: 32,
            cursor: "pointer",
          }}
        >
          try again
        </button>

        {error.digest && (
          <p
            style={{
              margin: 0,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            error {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
