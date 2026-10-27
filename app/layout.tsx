import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bill Tracker',
  description: 'Keep track of your monthly bills and payments.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
