'use client';
import React from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { AlertDialogProvider } from '@/context/AlertDialogProvider';
import { AlertDialogComponent } from '@/components/ui/alert-dialog-component';
import { DataProvider } from '@/context/DataContext';
import { LoadingProvider } from '@/context/LoadingContext';
import { NavigationGuardProvider } from '@/context/NavigationGuardContext';
import { FishLoader } from '@/components/ui/fish-loader';
import { FloatingSidebarToggle } from '@/components/dashboard/floating-sidebar-toggle';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center print:hidden">
        <div className="text-center">
          <p className="text-lg font-semibold">Loading Dashboard...</p>
          <p className="text-muted-foreground">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <LoadingProvider>
    <NavigationGuardProvider>
    <SidebarProvider>
      <AlertDialogProvider>
        <div className="flex min-h-screen w-full">
          <div className="print:hidden">
            <DashboardSidebar />
          </div>

          <SidebarInset className="flex flex-1 flex-col transition-all duration-200">
            <div className="print:hidden">
              <DashboardHeader />
            </div>

            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 print:hidden">
              {children}
            </main>
          </SidebarInset>
        </div>

        <AlertDialogComponent />
        <FishLoader />
        <FloatingSidebarToggle />
      </AlertDialogProvider>
    </SidebarProvider>
    </NavigationGuardProvider>
    </LoadingProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DataProvider>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </DataProvider>
  );
}
