import type { SVGProps } from "react";

/**
 * Icons extracted from the Figma "Startup" file (NavBar section).
 * All use `currentColor` so they inherit text color and stay themeable.
 */

/* The navbar pill's hamburger (nodes 75:346–347) and ✕ (node 75:381) used to
   live here as two separate icons. They are now ONE morphing glyph in
   menu-toggle-icon.tsx — both Figma geometries are preserved there, as the
   animation's two end states, so the pill can rotate between them instead of
   hard-cutting. Nothing else ever consumed them. */

/** Check / tick used on the cards' "delivered" and "board ready" pills
 *  (receive-media + subscribe-media, Figma 124:254). Stroked with
 *  currentColor so the consumer sets its ink (both use the dark #263138). */
export function CheckMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

/** Paper-plane "send" glyph (lucide send-horizontal, Figma 328:181). Stroked
 *  with currentColor so the consumer sets its ink (the send button uses the
 *  dark #263138 on a white chip). */
export function SendHorizontal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M16.5001 8.99991C16.5001 9.07094 16.4799 9.14052 16.4419 9.20053C16.4039 9.26055 16.3496 9.30853 16.2854 9.3389L2.7854 15.7139C2.71797 15.7466 2.64227 15.7582 2.56813 15.7473C2.49399 15.7364 2.42485 15.7035 2.36969 15.6528C2.31452 15.6021 2.27589 15.5359 2.25881 15.463C2.24172 15.39 2.24698 15.3136 2.2739 15.2437L4.4054 9.52341C4.53115 9.18573 4.53115 8.81408 4.4054 8.47641L2.27315 2.75615C2.24609 2.68614 2.24077 2.60959 2.25786 2.5365C2.27495 2.46341 2.31367 2.39717 2.36896 2.3464C2.42426 2.29564 2.49357 2.26272 2.56785 2.25193C2.64213 2.24114 2.71794 2.25298 2.7854 2.28591L16.2854 8.66091C16.3496 8.69128 16.4039 8.73926 16.4419 8.79928C16.4799 8.85929 16.5001 8.92887 16.5001 8.99991ZM16.5001 8.99991H4.4999" />
    </svg>
  );
}

/** Upward arrow for the back-to-top control (back-to-top.tsx). Hand-drawn in
 *  this module's stroked, currentColor style — not from the Figma payload, and
 *  deliberately not a new icon-package import. */
export function ArrowUp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 14 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M7 15V1.5" />
      <path d="M1.5 7L7 1.5L12.5 7" />
    </svg>
  );
}

/* ── Sky-mode glyphs (theme controller, mode-switcher.tsx) ──────────────────
   Hand-drawn to match this module's stroked, currentColor style (lucide-shaped:
   sunrise/day/sunset/night). Not from the Figma payload — the switcher is a
   site addition — and deliberately NOT a new icon-package import. 24×24, round
   caps/joins, 1.75 stroke to sit comfortably at ~20px. */

/** Sunrise — sun cresting the horizon with an upward shaft. */
export function SunriseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 2v8" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m8 6 4-4 4 4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  );
}

/** Day — full sun with rays. */
export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

/** Sunset — sun dipping below the horizon with a downward shaft. */
export function SunsetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 10V2" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m16 6-4 4-4-4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  );
}

/** Night — crescent moon. */
export function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/** X / Twitter glyph (social row, node 75:309). */
export function XSocial(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M17.7512 2.96094H20.818L14.1179 10.6187L22 21.0391H15.8284L10.9946 14.7191L5.4636 21.0391H2.39492L9.56132 12.8483L2 2.96094H8.32824L12.6976 8.73762L17.7512 2.96094ZM16.6748 19.2035H18.3742L7.40492 4.70014H5.58132L16.6748 19.2035Z" />
    </svg>
  );
}

/** Instagram glyph (social row, node 75:311). */
export function InstagramSocial(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="31 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M39.6672 12C39.6672 10.1591 41.1591 8.6664 43 8.6664C44.8409 8.6664 46.3336 10.1591 46.3336 12C46.3336 13.8409 44.8409 15.3336 43 15.3336C41.1591 15.3336 39.6672 13.8409 39.6672 12ZM37.8651 12C37.8651 14.836 40.164 17.1349 43 17.1349C45.836 17.1349 48.1349 14.836 48.1349 12C48.1349 9.164 45.836 6.86512 43 6.86512C40.164 6.86512 37.8651 9.164 37.8651 12ZM47.1382 6.66152C47.1381 6.89886 47.2084 7.13089 47.3401 7.32829C47.4719 7.52568 47.6593 7.67956 47.8785 7.77047C48.0977 7.86138 48.339 7.88525 48.5718 7.83904C48.8046 7.79283 49.0185 7.67862 49.1863 7.51087C49.3542 7.34311 49.4686 7.12934 49.515 6.89658C49.5614 6.66382 49.5377 6.42253 49.447 6.20322C49.3563 5.98392 49.2025 5.79644 49.0052 5.6645C48.808 5.53257 48.576 5.4621 48.3386 5.462C48.0204 5.46215 47.715 5.58856 47.49 5.81347C47.265 6.03837 47.1384 6.34339 47.1382 6.66152ZM38.96 20.1398C37.985 20.0954 37.4551 19.933 37.103 19.7958C36.6361 19.614 36.303 19.3975 35.9527 19.0478C35.6025 18.698 35.3857 18.3652 35.2047 17.8983C35.0674 17.5463 34.905 17.0162 34.8607 16.0413C34.8122 14.9872 34.8026 14.6706 34.8026 12.0001C34.8026 9.3296 34.813 9.01384 34.8607 7.95888C34.9051 6.98392 35.0687 6.45488 35.2047 6.10184C35.3865 5.63496 35.603 5.30184 35.9527 4.9516C36.3025 4.60136 36.6353 4.38456 37.103 4.2036C37.455 4.06632 37.985 3.90392 38.96 3.8596C40.0141 3.81112 40.3307 3.80144 43 3.80144C45.6693 3.80144 45.9862 3.81192 47.0412 3.8596C48.0162 3.904 48.5452 4.0676 48.8982 4.2036C49.3651 4.38456 49.6982 4.60184 50.0485 4.9516C50.3987 5.30136 50.6147 5.63496 50.7965 6.10184C50.9338 6.45384 51.0962 6.98392 51.1405 7.95888C51.189 9.01384 51.1986 9.3296 51.1986 12.0001C51.1986 14.6706 51.189 14.9863 51.1405 16.0413C51.0961 17.0162 50.9329 17.5462 50.7965 17.8983C50.6147 18.3652 50.3982 18.6983 50.0485 19.0478C49.6987 19.3972 49.3651 19.614 48.8982 19.7958C48.5462 19.933 48.0162 20.0954 47.0412 20.1398C45.9871 20.1882 45.6705 20.1979 43 20.1979C40.3295 20.1979 40.0138 20.1882 38.96 20.1398ZM38.8772 2.06056C37.8126 2.10904 37.0852 2.27784 36.4499 2.52504C35.792 2.78032 35.235 3.1228 34.6785 3.67848C34.1219 4.23416 33.7803 4.792 33.525 5.44992C33.2778 6.0856 33.109 6.81264 33.0606 7.8772C33.0113 8.94344 33 9.28432 33 12C33 14.7157 33.0113 15.0566 33.0606 16.1228C33.109 17.1874 33.2778 17.9144 33.525 18.5501C33.7803 19.2076 34.122 19.7661 34.6785 20.3215C35.235 20.877 35.792 21.219 36.4499 21.475C37.0864 21.7222 37.8126 21.891 38.8772 21.9394C39.944 21.9879 40.2843 22 43 22C45.7157 22 46.0566 21.9887 47.1228 21.9394C48.1874 21.891 48.9144 21.7222 49.5501 21.475C50.2076 21.219 50.765 20.8772 51.3215 20.3215C51.8781 19.7658 52.219 19.2076 52.475 18.5501C52.7222 17.9144 52.8918 17.1874 52.9394 16.1228C52.9879 15.0558 52.9992 14.7157 52.9992 12C52.9992 9.28432 52.9879 8.94344 52.9394 7.8772C52.891 6.81256 52.7222 6.0852 52.475 5.44992C52.219 4.7924 51.8772 4.23504 51.3215 3.67848C50.7658 3.12192 50.2076 2.78032 49.5509 2.52504C48.9144 2.27784 48.1874 2.10824 47.1236 2.06056C46.0574 2.01208 45.7165 2 43.0008 2C40.2851 2 39.944 2.01128 38.8772 2.06056Z" />
    </svg>
  );
}

/* ── The work section's mode switcher (Figma "Startup" 862:850) ──────────────
   Two 24×24 marks that replaced the words "globe" and "grid" on the portfolio
   toggle. Both are TWO-TONE by design: a solid outline plus an inner detail at
   40% opacity. That second tone is why they are filled paths rather than
   strokes, and why the opacity lives on the path instead of the consumer —
   dimming the whole icon would flatten the two tones into one.

   `currentColor` on both tones, so the switcher's active/inactive states
   (text-white vs text-white/60) drive the icon for free, exactly as the rest of
   this file does. */

/** Globe — the sphere formation. Ring plus meridians (node 862:842). */
export function GlobeMode(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path opacity="0.4" d="M7.25195 11.9991C7.25197 11.0655 7.31072 10.1591 7.41992 9.29785C6.8088 9.45716 6.2503 9.64602 5.75684 9.85937C4.97587 10.1971 4.39119 10.58 4.0127 10.9668C3.63766 11.3502 3.50009 11.6982 3.5 11.9991L3.50684 12.1143C3.53833 12.3876 3.68462 12.6958 4.0127 13.0312C4.39116 13.4181 4.97596 13.8011 5.75684 14.1386C6.25028 14.352 6.80884 14.5409 7.41992 14.7002C7.31076 13.8391 7.25195 12.9324 7.25195 11.9991ZM14.7021 16.58C13.9922 16.6701 13.2515 16.7266 12.4902 16.7432L12 16.7491C11.067 16.7491 10.1606 16.6891 9.2998 16.58C9.45909 17.1909 9.64902 17.7488 9.8623 18.2421C10.1999 19.023 10.582 19.6078 10.9688 19.9864C11.3521 20.3615 11.7002 20.4999 12.001 20.5C12.3018 20.5 12.6497 20.3616 13.0332 19.9864C13.4201 19.6078 13.803 19.0232 14.1406 18.2421C14.3538 17.7489 14.5429 17.1908 14.7021 16.58ZM12.001 3.5C11.7002 3.50013 11.3521 3.63772 10.9688 4.01269C10.5819 4.39116 10.199 4.97593 9.86133 5.75683C9.64818 6.24981 9.45902 6.80756 9.2998 7.41797C10.1606 7.3089 11.067 7.25 12 7.25C12.9338 7.25001 13.8407 7.30869 14.7021 7.41797C14.5429 6.80754 14.3538 6.24981 14.1406 5.75683C13.803 4.97594 13.4201 4.39115 13.0332 4.01269C12.6499 3.63782 12.3018 3.5 12.001 3.5ZM8.75195 11.9991C8.75195 13.0662 8.8325 14.0836 8.97852 15.0205C9.91535 15.1665 10.9327 15.2491 12 15.2491L12.4609 15.2431C13.361 15.2233 14.2211 15.1454 15.0225 15.0205C15.1473 14.2193 15.2254 13.3597 15.2451 12.46L15.251 11.9991C15.251 10.9312 15.1686 9.91374 15.0225 8.97656C14.0853 8.83041 13.0677 8.75002 12 8.75C10.9328 8.75 9.91528 8.83056 8.97852 8.97656C8.83235 9.91367 8.75197 10.9312 8.75195 11.9991ZM16.7451 12.4903C16.7285 13.2509 16.6719 13.9909 16.582 14.7002C17.1921 14.5411 17.7494 14.3518 18.2422 14.1386C19.0231 13.8011 19.6078 13.4181 19.9863 13.0312C20.3613 12.6479 20.499 12.2999 20.499 11.9991C20.4989 11.6981 20.3614 11.3502 19.9863 10.9668C19.6078 10.58 19.0231 10.1971 18.2422 9.85937C17.7494 9.64635 17.1921 9.457 16.582 9.29785C16.6912 10.1591 16.751 11.0655 16.751 11.9991L16.7451 12.4903ZM21.999 11.9991C21.999 12.8024 21.6194 13.5067 21.0586 14.0801C20.501 14.6501 19.7307 15.1295 18.8379 15.5156C18.0938 15.8373 17.2398 16.1031 16.3076 16.3057C16.1049 17.2387 15.8395 18.0933 15.5176 18.8379C15.1316 19.7306 14.6529 20.5009 14.083 21.0585C13.5096 21.6196 12.8045 22 12.001 22C11.1976 21.9999 10.4933 21.6196 9.91992 21.0585C9.35003 20.5009 8.87137 19.7306 8.48535 18.8379C8.16337 18.0932 7.89607 17.2388 7.69336 16.3057C6.76064 16.1031 5.90661 15.8375 5.16211 15.5156C4.26916 15.1295 3.49812 14.6502 2.94043 14.0801C2.41462 13.5425 2.04856 12.8898 2.00488 12.1484L2 11.9991C2.00009 11.1958 2.37955 10.4914 2.94043 9.91797C3.49812 9.34791 4.26917 8.86947 5.16211 8.4834C5.90673 8.16147 6.76046 7.89408 7.69336 7.6914C7.89603 6.75907 8.16356 5.90534 8.48535 5.16113C8.87142 4.26841 9.34994 3.49799 9.91992 2.94043C10.4933 2.37956 11.1977 2.00013 12.001 2C12.8044 2 13.5096 2.37944 14.083 2.94043C14.6529 3.49801 15.1316 4.26841 15.5176 5.16113C15.8393 5.90525 16.105 6.75921 16.3076 7.6914C17.2399 7.89406 18.0937 8.16163 18.8379 8.4834C19.7306 8.86943 20.501 9.34801 21.0586 9.91797C21.6195 10.4914 21.9989 11.1957 21.999 11.9991Z" />
      <path d="M20.4912 11.5625C20.2636 7.07173 16.5501 3.5 12.0029 3.5C7.30913 3.50001 3.50391 7.30602 3.50391 12C3.50396 16.694 7.30917 20.5 12.0029 20.5C16.6967 20.5 20.5019 16.694 20.502 12L20.4912 11.5625ZM21.9893 12.5147C21.7214 17.7978 17.3527 22 12.0029 22C6.48057 22 2.00396 17.5222 2.00391 12C2.00391 6.47777 6.48053 2.00001 12.0029 2C17.5253 2 22.0019 6.47777 22.002 12L21.9893 12.5147Z" />
    </svg>
  );
}

/** Masonry wall — a framed layout with uneven columns (node 862:846). */
export function GridMode(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M18.5 3.25C19.7426 3.25 20.75 4.25736 20.75 5.5L20.75 18.5C20.75 19.7426 19.7426 20.75 18.5 20.75L5.5 20.75C4.2574 20.75 3.25 19.7426 3.25 18.5L3.25 5.5C3.25 4.25736 4.2574 3.25 5.5 3.25L18.5 3.25ZM19.25 5.5C19.25 5.08579 18.9142 4.75 18.5 4.75L5.5 4.75C5.0858 4.75 4.75 5.08579 4.75 5.5L4.75 18.5C4.75 18.9142 5.0858 19.25 5.5 19.25L18.5 19.25C18.9142 19.25 19.25 18.9142 19.25 18.5L19.25 5.5Z" />
      <path opacity="0.4" d="M15.418 19.25L15.418 4.75L13.918 4.75L13.918 8.58301L4.75098 8.58301L4.75098 10.083L8.58498 10.083L8.58498 19.25L10.085 19.25L10.085 10.083L13.918 10.083L13.918 19.25L15.418 19.25Z" />
    </svg>
  );
}
