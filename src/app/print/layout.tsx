import '../globals.css';
import { Suspense } from 'react';
import { ThemeProvider } from '../theme-provider';

// This is a minimal layout for printing pages, ensuring no dashboard UI is included.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Force light theme for all print previews to ensure a consistent "what you see is what you get" experience.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" forcedTheme="light">
            <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Print Preview...</div>}>
            {children}
            </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
