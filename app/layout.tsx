import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Destruction Lab', description: 'Break the web beautifully. Screenshot-only visual effects.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
