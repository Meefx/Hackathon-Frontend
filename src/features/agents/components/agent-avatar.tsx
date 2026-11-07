import type { ReactNode } from "react";
import type { AgentDefinition } from "../types";

const accessories: Record<AgentDefinition["role"], ReactNode> = {
  manager: (
    <>
      <path d="m91 119 9 7 9-7-3 27H94Z" fill="currentColor" />
      <g transform="rotate(10 158 130)">
        <rect x="138" y="106" width="39" height="48" rx="7" fill="#fff" />
        <rect x="149" y="101" width="17" height="10" rx="3" fill="#ffd17d" />
        <path d="M147 121h21m-21 9h21m-21 9h13" />
      </g>
    </>
  ),
  collection: (
    <g transform="rotate(-8 155 111)">
      <path
        d="M140 88h29a10 10 0 0 1 10 10v17a10 10 0 0 1-10 10h-14l-12 9v-9h-3a10 10 0 0 1-10-10V98a10 10 0 0 1 10-10Z"
        fill="#fff"
      />
      <g fill="currentColor" stroke="none">
        <circle cx="143" cy="107" r="3" />
        <circle cx="154" cy="107" r="3" />
        <circle cx="165" cy="107" r="3" />
      </g>
    </g>
  ),
  knowledge: (
    <>
      <path
        d="M100 126c-14-10-28-11-43-7v39c15-4 29-3 43 7 14-10 28-11 43-7v-39c-15-4-29-3-43 7Z"
        fill="#fff"
      />
      <path d="M100 126v39m-32-34 20 4m-20 8 20 4m24-12 20-4m-20 16 20-4" />
      <g fill="none" stroke="#fff" strokeWidth="2.5">
        <rect x="75" y="57" width="19" height="18" rx="6" />
        <rect x="106" y="57" width="19" height="18" rx="6" />
        <path d="M94 64h12" />
      </g>
    </>
  ),
  qa: (
    <>
      <path
        d="m155 103 25 10v17c0 15-25 27-25 27s-25-12-25-27v-17Z"
        fill="#fff"
      />
      <path d="m144 129 8 8 15-18" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="m42 37 4 6 7-2-3 7 4 5-7-1-5 5 1-7-5-5 7-1Z" fill="#ffd17d" stroke="none" />
    </>
  ),
  improvement: (
    <g transform="rotate(8 155 129)">
      <rect x="131" y="107" width="48" height="47" rx="8" fill="#fff" />
      <path d="M141 143v-10m12 10v-18m12 18v-26" stroke="currentColor" strokeWidth="6" />
      <path d="m136 102 12-12 12 3 14-14m-11 0h11v11" fill="none" />
    </g>
  ),
  copilot: (
    <>
      <path d="M43 65v-7a57 43 0 0 1 114 0v11" fill="none" strokeWidth="7" />
      <rect x="35" y="58" width="16" height="29" rx="7" fill="#fff" />
      <rect x="149" y="58" width="16" height="29" rx="7" fill="#fff" />
      <path d="M158 86v5c0 9-9 14-21 14h-14" fill="none" />
      <rect x="114" y="100" width="16" height="9" rx="4" fill="currentColor" />
      <path d="m100 125 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="#ffd17d" />
    </>
  ),
};

export function AgentAvatar({
  role,
  className,
}: {
  role: AgentDefinition["role"];
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 180"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="100" cy="167" rx="53" ry="7" fill="currentColor" opacity=".13" />
      <circle cx="33" cy="96" r="5" fill="currentColor" opacity=".2" />
      <circle cx="166" cy="41" r="7" fill="currentColor" opacity=".14" />
      <path d="M167 65v10m-5-5h10M35 27v10m-5-5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5" />
      <g stroke="#293442" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M100 33V21" />
        <circle cx="100" cy="15" r="6" fill="currentColor" />
        <path d="m65 121-17 15m87-15 16 15" strokeWidth="13" />
        <circle cx="46" cy="139" r="8" fill="#fff" />
        <circle cx="154" cy="139" r="8" fill="#fff" />
        <rect x="77" y="149" width="18" height="15" rx="6" fill="currentColor" />
        <rect x="105" y="149" width="18" height="15" rx="6" fill="currentColor" />
        <rect x="67" y="112" width="66" height="44" rx="17" fill="#fff" />
        <path d="M91 123h18" stroke="currentColor" strokeWidth="5" />
        <rect x="42" y="57" width="15" height="26" rx="7" fill="#fff" />
        <rect x="143" y="57" width="15" height="26" rx="7" fill="#fff" />
        <rect x="51" y="32" width="98" height="78" rx="25" fill="currentColor" />
        <rect x="63" y="46" width="74" height="48" rx="15" fill="#293442" />
        <g fill="#fff" stroke="none">
          <rect x="78" y="60" width="11" height="14" rx="5" />
          <rect x="111" y="60" width="11" height="14" rx="5" />
        </g>
        <path d="M91 81q9 7 18 0" fill="none" stroke="#fff" strokeWidth="2.5" />
        <path d="M65 39h21" stroke="#fff" strokeWidth="3" opacity=".5" />
        {accessories[role]}
      </g>
    </svg>
  );
}
