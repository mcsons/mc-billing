'use client';

import '../globals.css';
import { Suspense, useEffect } from 'react';

// This is a minimal layout for printing pages, ensuring no dashboard UI is included.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Forcefully remove the 'dark' class from the html element
    // to ensure print previews always render in light mode,
    // overriding any theme preference inherited from the main app.
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Print Preview...</div>}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
