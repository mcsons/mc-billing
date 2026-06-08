'use client';
import React from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { AlertDialogProvider } from '@/context/AlertDialogProvider';
import { AlertDialogComponent } from '@/components/ui/alert-dialog-component';
import { DataProvider } from '@/context/DataContext';
import { NavigationGuardProvider } from '@/context/NavigationGuardContext';
import { BillingGuardProvider } from '@/context/BillingGuardContext';
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
    <SidebarProvider>
      <BillingGuardProvider>
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
      </AlertDialogProvider>
      </BillingGuardProvider>
    </SidebarProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavigationGuardProvider>
      <DataProvider>
        <AuthenticatedLayout>{children}</AuthenticatedLayout>
      </DataProvider>
    </NavigationGuardProvider>
  );
}
