# Cal.com calendar — theming options & decision (parked)

**Status:** research done, decision deferred. The booking section
(`components/sections/book-a-call/`) currently shows a "coming soon" placeholder
box; the live embed is built and parked in `cal-embed.tsx`. This doc records what
we found about matching a Cal.com calendar to the site's look, so we can pick a
path when we come back to it.

Context: the pricing page's "not sure which fits? talk to us." section
(Figma 746:4592) holds a dashed glass box that will contain our Cal.com booking
calendar. The question: **can the calendar be themed to our design?** It ships
with a base theme that feels non-modifiable.

---

## TL;DR

- The **iframe embed** (what we've built) can only do **light/dark + a brand
  accent colour** — and even the accent is flaky via config. Fonts, backgrounds,
  card shapes, and layout **cannot** be changed (cross-origin iframe, no CSS
  injection). It will never go transparent over the sky or use Product Sans.
- **Cal Atoms** (`@calcom/atoms`) are native React components (no iframe) and are
  **fully restylable** — brand, fonts, backgrounds — and could even track our
  sky-mode palette (`lib/theme`). But they require a paid **Platform plan** +
  OAuth client + API key + managed users. Heavy for a single booking CTA.
- **Recommendation:** stay with the embed, set `theme: "light"`, set the brand
  accent in the Cal **account dashboard** (more reliable than the config route),
  and lean on our glass-box framing. Only go Atoms if a not-quite-matching
  calendar genuinely bothers us enough to justify the Platform plan + a real
  backend integration.

---

## Option 1 — the iframe embed (built, parked)

A cross-origin iframe served from `app.cal.com`. This is Cal's standard inline
embed and what `cal-embed.tsx` implements (vanilla inline loader, no npm dep,
lazy-loaded on scroll-in).

| Knob | Works? | Notes |
|------|--------|-------|
| `theme: "light" \| "dark" \| "auto"` | ✅ reliable | we'd use `light` (day sky) |
| Brand accent (selected dates, buttons) | ⚠️ partial | **set it in the Cal account settings**, not via config — pushing `--cal-brand` through `cssVarsPerTheme` is flaky (some branding vars are set inline, so CSS specificity blocks the override — see bugs below) |
| `layout` (`month_view` / `week_view` / `column_view`) | ✅ | — |
| `hideEventTypeDetails` | ✅ | hides the left detail panel |
| Fonts, backgrounds, card shapes, full layout | ❌ | not exposed, and a cross-origin iframe can't be CSS-injected from the parent |

**Bottom line:** light/dark + brand accent only. The widget internals stay Cal's
(their font, their card look). Our framing (the dashed glass box) is what makes
it read as "ours."

### Known brand-colour bugs (why the accent is flaky via config)

- calcom/cal.com#16732 — `--cal-brand-color` not adjustable through
  `cssVarsPerTheme`.
- calcom/cal.diy#10497 — embed brand colours don't work properly.
- calcom/cal.com#9025 — embed CSS-vars UI config issues (branding vars set
  inline, specificity blocks the embed style tag).

---

## Option 2 — Cal Atoms (`@calcom/atoms`) — full control

Native React components rendered in our own DOM (no iframe). Tailwind v4, styles
scoped/prefixed so they don't collide with the site.

- **Theming:** `customClassNames` (root + nested parts) and CSS variables —
  brand colours, typography, backgrounds all restylable. Could match the site
  exactly and even recolour per sky mode (sunrise/day/sunset/night).
- **Requirements (the catch):**
  - a Cal.com **Platform plan** (paid tier, separate from the free booking plan),
  - an **OAuth client ID** + **API key**,
  - **managed users** (access tokens) and a `CalProvider` wrapper
    (`apiUrl`, `accessToken`, `clientId`),
  - import their `@calcom/atoms/globals.min.css`.
- Designed for products embedding scheduling **for their own users at scale** —
  overkill for one "book a 15-min call" CTA, and it adds a real backend surface
  (OAuth + managed users) this marketing site otherwise doesn't need.

---

## Current implementation notes

- `components/sections/book-a-call/book-a-call.tsx` — the section; box shows the
  "coming soon" placeholder.
- `components/sections/book-a-call/cal-embed.tsx` — the built-but-parked inline
  embed. Reads `CAL_LINK` from `NEXT_PUBLIC_CAL_LINK` (placeholder `ascnd/intro`
  until the real slug lands). Already wires `theme: "light"` +
  `cssVarsPerTheme.light["cal-brand"]` + `layout: "month_view"`.
- **Why it's parked:** the placeholder `calLink` 404s, and on a failed load Cal's
  `embed.js` resize/scroll-sync logic hijacks page scroll (you can't scroll past
  the section). With a real, resolving link this goes away. To re-mount: set
  `NEXT_PUBLIC_CAL_LINK` and swap the placeholder `<p>` back to `<CalEmbed />`.

---

## Sources

- Booker Embed (Atoms) docs — https://cal.com/docs/platform/atoms/booker-embed
- Enhance Your Brand with Custom Theme Colors — https://cal.com/blog/enhance-your-brand-with-custom-theme-colors-on-cal-com
- Issue #16732 (`--cal-brand-color` not adjustable) — https://github.com/calcom/cal.com/issues/16732
- Issue #10497 (embed brand colours broken) — https://github.com/calcom/cal.diy/issues/10497
- Issue #9025 (embed CSS-vars config) — https://github.com/calcom/cal.com/issues/9025
