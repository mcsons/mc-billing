'use client';

import { Suspense } from 'react';
import { PrintLayout } from '@/components/dashboard/print-layout';

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Preview...</div>}>
      <PrintLayout />
    </Suspense>
  );
}
