import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FPS Game',
  description: 'A simple first-person shooter game',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
} 