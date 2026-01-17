import '../globals.css';
import { Suspense } from 'react';

// This is a minimal layout for printing pages, ensuring no dashboard UI is included.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Print Preview...</div>}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
