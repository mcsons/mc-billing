'use client';

import { Suspense } from 'react';

import { DataProvider } from '@/context/DataContext';

// This is a minimal layout for printing pages, ensuring no dashboard UI is included.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div className="print-layout-wrapper bg-background text-foreground">
      {/* This style block ensures the print preview has a dark background, matching the app shell, without affecting the printed output. */}
      <DataProvider>
      <style jsx global>{`
        @media screen {
          body {
            background-color: hsl(215 28% 12%) !important;
          }
        }
        @media print {
          .print-layout-wrapper {
             min-height: 0 !important;
             height: auto !important;
             display: block !important;
          }
        }
      `}</style>
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center text-white">Loading Print Preview...</div>}>
        {children}
      </Suspense>
      </DataProvider>
    </div>
  );
}
