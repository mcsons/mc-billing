import '../globals.css';
import { Suspense } from 'react';

// This is a minimal layout for printing pages, ensuring no dashboard UI is included.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Force light theme for all print previews to ensure a consistent "what you see is what you get" experience.
    <html lang="en" className="light" style={{ colorScheme: 'light' }} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Print Preview...</div>}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
