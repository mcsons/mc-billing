'use client';

import { Suspense } from 'react';

// This is a minimal layout for printing pages, ensuring no dashboard UI is included.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* This style block ensures the print preview has a dark background, matching the app shell, without affecting the printed output. */}
      <style jsx global>{`
        @media screen {
          body {
            background-color: hsl(215 28% 12%) !important;
          }
        }
      `}</style>
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center text-white">Loading Print Preview...</div>}>
        {children}
      </Suspense>
    </div>
  );
}
