/**
 * Cal.com embed — the ONE bootstrap + config shared by every booking surface on
 * the site:
 *   • the INLINE calendar that fills the glass box on /pricing
 *     (components/sections/book-a-call/cal-embed.tsx)
 *   • the "book a 15-min intro call" POPUP buttons
 *     (components/ui/book-call-button.tsx), booted by
 *     components/providers/cal-provider.tsx
 *
 * WHY THE VANILLA LOADER (not @calcom/embed-react): the site avoids runtime
 * dependencies for third-party widgets, and the package is not a substitute for
 * one — `getCalApi()` still fetches app.cal.com/embed/embed.js at runtime, so it
 * only adds a build dependency on top of the same network cost. This is Cal's
 * official embed snippet ported into a typed helper, which also lets us control
 * exactly WHEN the script loads. Config values below mirror the snippet Cal's
 * dashboard generates for the ascnd `intro-session` event — keep them in sync
 * with it, not with a hand-tuned copy.
 */

// "<cal-username>/<event-type-slug>". Env override for previews/staging.
export const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK ?? "ascndd/intro-session";

export const CAL_ORIGIN = "https://app.cal.com";

/**
 * Namespaces scope one Cal instance each. As the routes stand the two never meet
 * — the modal is homepage-only, the inline calendar is /pricing-only — but they
 * get SEPARATE namespaces anyway, as a guard: a Cal instance tracks a single
 * `iframe`, so if a later change ever put a booking BUTTON on /pricing (or the
 * calendar on the homepage) one shared namespace would let whichever opened last
 * clobber the other's iframe reference. The namespace is a client-side instance
 * key only; `calLink` is what identifies the event, so the second one needs no
 * counterpart in the Cal.com dashboard.
 */
export const INLINE_NS = "intro-session";
export const POPUP_NS = "intro-session-popup";

// The brand accent pushed into Cal's UI — the sky-tint blue configured on the
// ascnd Cal.com event (dashboard snippet), used for selected dates / buttons.
const BRAND = "#9EC8FC";

/**
 * Cal's `ui` call — theming, applied per namespace.
 *
 * Pinned to Cal's LIGHT theme, always. Without an explicit `theme`, Cal's booker
 * follows the visitor's OS prefers-color-scheme, so a dark-mode device got a
 * dark calendar over the bright day sky. It deliberately does NOT follow the
 * site's sky mode either — one stable white calendar across
 * sunrise/day/sunset/night.
 */
export const CAL_UI_CONFIG = {
  theme: "light",
  cssVarsPerTheme: { light: { "cal-brand": BRAND } },
  hideEventTypeDetails: false,
  layout: "month_view",
} as const;

/**
 * The booker's BOOT config (Cal's `config`), for both the inline embed and the
 * popup. `theme` has to be pinned here as well as in `ui` above: the later ui()
 * call alone loses to the device's prefers-color-scheme (a dark-mode phone
 * rendered a dark calendar over the day sky).
 */
export const CAL_BOOKING_CONFIG = {
  layout: "month_view",
  theme: "light",
  // Cal's dashboard snippet ships this as a string, not a boolean.
  useSlotsViewOnSmallScreen: "true",
} as const;

/**
 * The same config as a JSON string, for the popup buttons' `data-cal-config`
 * attribute — embed.js reads that attribute and JSON.parse()s it on click.
 */
export const CAL_BOOKING_CONFIG_JSON = JSON.stringify(CAL_BOOKING_CONFIG);

type CalApi = ((...args: unknown[]) => void) & {
  loaded?: boolean;
  ns?: Record<string, CalApi>;
  q?: unknown[];
};

declare global {
  interface Window {
    Cal?: CalApi;
  }
}

/**
 * Cal's official embed bootstrap (faithful port of their snippet): defines
 * window.Cal as a command queue that injects embed.js on first use, then
 * replays the queued commands once it loads. Idempotent — only the first call
 * injects the script.
 */
export function ensureCal(): CalApi {
  const w = window;
  if (!w.Cal) {
    const queue = function (api: CalApi, args: IArguments | unknown[]) {
      (api.q ??= []).push(args);
    };
    const cal = function (this: unknown, ...args: unknown[]) {
      const c = w.Cal as CalApi;
      if (!c.loaded) {
        c.ns = {};
        c.q = c.q || [];
        document.head
          .appendChild(document.createElement("script"))
          .setAttribute("src", `${CAL_ORIGIN}/embed/embed.js`);
        c.loaded = true;
      }
      if (args[0] === "init") {
        const api = function (this: unknown, ...a: unknown[]) {
          queue(api as unknown as CalApi, a);
        } as unknown as CalApi;
        const namespace = args[1];
        api.q = api.q || [];
        if (typeof namespace === "string") {
          c.ns![namespace] = c.ns![namespace] || api;
          queue(c.ns![namespace], args);
          queue(c, ["initNamespace", namespace]);
        } else queue(c, args);
        return;
      }
      queue(c, args);
    } as CalApi;
    w.Cal = cal;
  }
  return w.Cal;
}

/**
 * Boot the embed (if it isn't already) and return the command API for one
 * namespace. Every caller goes through here so no surface can forget the `init`
 * — embed.js THROWS ("Namespace … isn't defined") when a `data-cal-link` click
 * names a namespace that was never initialised.
 */
export function initCalNamespace(namespace: string): CalApi {
  const Cal = ensureCal();
  Cal("init", namespace, { origin: CAL_ORIGIN });
  return Cal.ns![namespace];
}
