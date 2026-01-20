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
    const htmlElement = document.documentElement;

    // This function forcefully ensures light mode.
    const forceLightMode = () => {
      if (htmlElement.classList.contains('dark')) {
        htmlElement.classList.remove('dark');
      }
      // Also set the color scheme for good measure.
      htmlElement.style.colorScheme = 'light';
    };

    // Run it immediately on mount.
    forceLightMode();

    // Create a MutationObserver to watch for any future changes to the <html> class attribute.
    // This is the robust part of the fix: if next-themes tries to add 'dark' back,
    // this observer will catch it and remove it instantly.
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          forceLightMode();
        }
      });
    });

    // Start observing the <html> element.
    observer.observe(htmlElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Clean up the observer when the component unmounts.
    return () => {
      observer.disconnect();
    };
  }, []); // Empty dependency array ensures this runs only once on mount.


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
