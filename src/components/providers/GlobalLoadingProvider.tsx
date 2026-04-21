'use client';
import { LoadingProvider } from '@/context/LoadingContext';
import { FishLoader } from '@/components/ui/fish-loader';
import { ReactNode } from 'react';

/**
 * GlobalLoadingProvider — wraps the entire app with LoadingContext
 * and renders FishLoader as a global overlay.
 * This is a client component so it can be safely imported by the
 * server-component root layout.
 */
export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  return (
    <LoadingProvider>
      {children}
      <FishLoader />
    </LoadingProvider>
  );
}
