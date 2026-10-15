// Line icons from the design, drawn with currentColor.
type P = { size?: number };
const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

export const Leaf = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15" /><path d="M5 19l7-7" /></svg>
);
export const Sprout = ({ size = 30 }: P) => (
  <svg {...base(size)}><path d="M12 21v-9" /><path d="M12 12c0-4 3-7 8-7 0 4-3 7-8 7z" /><path d="M12 15c0-3-2.5-5.5-7-5.5 0 3 2.5 5.5 7 5.5z" /></svg>
);
export const Calendar = ({ size = 18 }: P) => (
  <svg {...base(size)}><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /></svg>
);
export const Back = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M15 18l-6-6 6-6" /></svg>
);
export const Bell = ({ size = 18 }: P) => (
  <svg {...base(size)}><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 003.4 0" /></svg>
);
export const Clock = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
);
export const Plus = ({ size = 20 }: P) => (
  <svg {...base(size)} strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
);
export const Minus = ({ size = 20 }: P) => (
  <svg {...base(size)} strokeWidth={2}><path d="M5 12h14" /></svg>
);
export const Check = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export const Hills = () => (
  <svg className="hills" viewBox="0 0 390 56" preserveAspectRatio="none" aria-hidden="true">
    <circle cx="318" cy="30" r="15" fill="#E6D9AE" opacity="0.85" />
    <path d="M0 36 C 60 18, 120 20, 190 34 S 320 46, 390 28 L390 56 L0 56 Z" fill="#3B5644" />
    <path d="M0 46 C 80 32, 150 40, 230 46 S 340 40, 390 44 L390 56 L0 56 Z" fill="#4E6E57" />
    <path d="M0 56 L0 52 C 100 46, 260 58, 390 50 L390 56 Z" fill="#EEEFE7" />
  </svg>
);
export const MapIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M9 4L3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5L9 4z" /><path d="M9 4v13.5M15 6.5V20" /></svg>
);
export const Close = ({ size = 20 }: P) => (
  <svg {...base(size)} strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
