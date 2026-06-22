interface IP {
  className?: string;
}
const S = ({ children, className }: { children: React.ReactNode } & IP) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const Play = (p: IP) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={p.className}>
    <path d="M7 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 7 5.5z" />
  </svg>
);
export const Pause = (p: IP) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={p.className}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
export const Stop = (p: IP) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={p.className}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
export const ToStart = (p: IP) => (
  <S className={p.className}>
    <path d="M19 5v14l-9-7 9-7z" fill="currentColor" stroke="none" />
    <line x1="6" y1="5" x2="6" y2="19" />
  </S>
);
export const Plus = (p: IP) => (
  <S className={p.className}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </S>
);
export const Check = (p: IP) => (
  <S className={p.className}>
    <polyline points="20 6 9 17 4 12" />
  </S>
);
export const Trash = (p: IP) => (
  <S className={p.className}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </S>
);
export const Upload = (p: IP) => (
  <S className={p.className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </S>
);
export const Music = (p: IP) => (
  <S className={p.className}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </S>
);
export const ZoomIn = (p: IP) => (
  <S className={p.className}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </S>
);
export const ZoomOut = (p: IP) => (
  <S className={p.className}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </S>
);
export const Loop = (p: IP) => (
  <S className={p.className}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </S>
);
export const Edit = (p: IP) => (
  <S className={p.className}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </S>
);
export const X = (p: IP) => (
  <S className={p.className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </S>
);
