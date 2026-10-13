import type { Metadata, Viewport } from 'next';
import '@fontsource/young-serif/400.css';
import '@fontsource-variable/figtree';
import './globals.css';
import { EVENT } from '@/lib/event';

export const metadata: Metadata = {
  title: `${EVENT.name} · Activities`,
  description: 'Sign up for activities, pick a time, and get a reminder 15 minutes before.',
};

export const viewport: Viewport = { themeColor: '#2a3d31', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
