import type { SVGProps } from "react";

/**
 * ascnd logo — the stacked double chevron ("ascend"). Figma node 103:53
 * ("Maanay Logo-01 1"), 30×30, two white vector chevrons.
 *
 * Standalone component (used in the nav pill today) kept separate so it can be
 * animated on its own. The two chevrons are individual <path>s with stable
 * `data-part` hooks, so they can be targeted/animated independently — e.g. a
 * staggered upward "ascend" motion. Uses `currentColor`, so color follows the
 * surrounding text color.
 */
export default function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 30 30"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        data-part="chevron-top"
        d="M29.8135 17.8918L26.6693 21.0363C26.196 21.5096 25.4287 21.5096 24.9554 21.0363L16.0257 12.1065C15.5523 11.6332 14.7851 11.6332 14.3118 12.1065L5.38207 21.0363C4.90873 21.5096 4.14151 21.5096 3.66818 21.0363L0.523457 17.8918C0.0501237 17.4185 0.0501237 16.6513 0.523457 16.1779L14.3112 2.39016C14.7846 1.91682 15.5518 1.91682 16.0251 2.39016L29.8135 16.1779C30.2868 16.651 30.2868 17.4185 29.8135 17.8918Z"
      />
      <path
        data-part="chevron-bottom"
        d="M23.2412 24.4641L20.097 27.608C19.6237 28.0814 18.8565 28.0814 18.3832 27.608L16.0262 25.2511C15.5529 24.7777 14.7854 24.7777 14.3123 25.2511L11.9548 27.6089C11.4815 28.0822 10.7143 28.0822 10.2409 27.6089L7.09621 24.4647C6.62288 23.9914 6.62288 23.2241 7.09621 22.7508L14.3118 15.5347C14.7851 15.0614 15.5523 15.0614 16.0257 15.5347L23.2412 22.7502C23.7145 23.2233 23.7145 23.9908 23.2412 24.4641Z"
      />
    </svg>
  );
}
