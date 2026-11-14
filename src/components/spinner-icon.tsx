import type { SVGProps } from "react";

/**
 * Loading arc in Solar's 1.5 line. Solar has no spinner, and a spinning refresh icon
 * would look like the "Buscar de novo" action, so loading gets its own open arc.
 */
export function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M21.25 12A9.25 9.25 0 1 1 12 2.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
