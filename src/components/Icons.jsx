import React from "react";
const paths = {
  day: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  week: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4m10-4v4M3 10h18m-13 4h1m3 0h1m3 0h1m-9 4h1m3 0h1" />
    </>
  ),
  progress: <path d="M3 18l5-5 4 3 8-11m-5 0h5v5" />,
  settings: (
    <>
      <path d="M4 7h8m6 0h2M4 17h2m6 0h8" />
      <circle cx="15" cy="7" r="3" />
      <circle cx="9" cy="17" r="3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 8a8 8 0 00-14-3L3 8m0-5v5h5M4 16a8 8 0 0014 3l3-3m0 5v-5h-5" />
    </>
  ),
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M6 18L18 6" />,
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
    </>
  ),
  fuel: (
    <>
      <path d="M13 2L5 14h6l-1 8 9-12h-6l1-8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0116 0v2" />
    </>
  ),
  meal: (
    <>
      <path d="M5 3v7m3-7v7m3-7v7M5 7h6m-3 3v11M18 3v18m0-18c-3 3-3 8 0 8" />
    </>
  ),
};
export default function Icon({ name, ...props }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
